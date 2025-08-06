import { readFileSync } from 'fs';
import { SVGParser } from './svgParser.js';
import { HullCalculator } from './hullCalculator.js';
import { HullPadding } from './hullPadding.js';
import { FocusAreaParser } from './focusAreaParser.js';
import { SVGRenderer, SVGRenderResult } from './svgRenderer.js';
import {
  Point,
  CurveType,
  SplineConfig,
  FocusArea,
} from './types.js';

export interface AnnotationOptions {
  concavity: number;
  lengthThreshold: number;
  padding: number;
  curveType: CurveType;
  curveTension: number;
  curveAlpha: number;
  verbose?: boolean;
}

export class AnnotationService {
  private svgRenderer: SVGRenderer;

  constructor() {
    this.svgRenderer = new SVGRenderer();
  }

  private calculateHull(
    points: Point[],
    options: AnnotationOptions,
    name: string
  ): { points: Point[]; area: number; perimeter: number } {
    if (options.verbose) {
      console.error(`Found ${points.length} points for "${name}"`);
    }

    // Calculate concave hull
    const calculator = new HullCalculator();
    const result = calculator.calculateConcaveHull(
      points,
      options.concavity,
      options.lengthThreshold
    );

    if (options.verbose) {
      console.error(
        `Hull calculated for "${name}": ${result.points.length} points`
      );
      console.error(
        `Area: ${result.area.toFixed(2)}, Perimeter: ${result.perimeter.toFixed(2)}`
      );
    }

    // Add padding to hull points
    const paddedPoints = HullPadding.addPadding(result.points, options.padding);

    return {
      points: paddedPoints,
      area: result.area,
      perimeter: result.perimeter,
    };
  }

  private processFocusArea(
    focusAreaName: string,
    focusAreas: FocusArea[],
    parser: SVGParser,
    options: AnnotationOptions
  ): SVGRenderResult {
    const entities = FocusAreaParser.getEntitiesForFocusArea(
      focusAreas,
      focusAreaName
    );
    const color = FocusAreaParser.getColorForFocusArea(
      focusAreas,
      focusAreaName
    );
    const url = FocusAreaParser.getUrlForFocusArea(focusAreas, focusAreaName);
    const description = FocusAreaParser.getDescriptionForFocusArea(
      focusAreas,
      focusAreaName
    );
    const tooltip = FocusAreaParser.getTooltipForFocusArea(
      focusAreas,
      focusAreaName
    );

    if (options.verbose) {
      console.error(
        `Processing focus area "${focusAreaName}" with entities: ${entities.join(', ')}`
      );
    }

    const points = parser.extractPointsFromEntityGroups(entities);
    const hull = this.calculateHull(points, options, focusAreaName);

    return {
      name: focusAreaName,
      points: hull.points,
      area: hull.area,
      perimeter: hull.perimeter,
      color,
      url,
      description,
      tooltip,
    };
  }

  private processEntityGroup(
    entityNames: string[],
    parser: SVGParser,
    options: AnnotationOptions
  ): SVGRenderResult {
    const points = parser.extractPointsFromEntityGroups(entityNames);

    if (options.verbose) {
      console.error(`Searching for entities: ${entityNames.join(', ')}`);
    }

    const displayName =
      entityNames.length === 1 ? entityNames[0] : entityNames.join('+');
    const hull = this.calculateHull(points, options, displayName);

    return {
      name: displayName,
      points: hull.points,
      area: hull.area,
      perimeter: hull.perimeter,
    };
  }

  /**
   * Generate annotations for SVG file
   */
  annotate(
    svgPath: string,
    entityNames: string[],
    focusAreas: FocusArea[],
    focusAreaNames: string[],
    options: AnnotationOptions,
    useAreasMode: boolean
  ): string {
    // Parse SVG once
    const parser = new SVGParser(svgPath);

    // Process each focus area/entity group
    const results: SVGRenderResult[] = [];

    if (useAreasMode) {
      // Process each focus area separately
      for (const focusAreaName of focusAreaNames) {
        results.push(
          this.processFocusArea(focusAreaName, focusAreas, parser, options)
        );
      }
    } else {
      // Process single entity group (original behavior)
      results.push(this.processEntityGroup(entityNames, parser, options));
    }

    if (options.verbose && options.padding > 0) {
      console.error(`Applied padding: ${options.padding} SVG units`);
    }

    // Read SVG content for SVG output
    const svgContent = readFileSync(svgPath, 'utf-8');

    // Create spline configuration
    const splineConfig: SplineConfig = {
      type: options.curveType,
      tension: options.curveTension,
      alpha: options.curveAlpha,
    };

    // Generate SVG output
    return this.svgRenderer.generateSVGOutput(
      results,
      splineConfig,
      svgContent,
      parser
    );
  }
}