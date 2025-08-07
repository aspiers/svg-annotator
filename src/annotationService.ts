import { readFileSync } from 'fs';
import { SVGParser } from './svgParser.js';
import { HullCalculator } from './hullCalculator.js';
import { HullPadding } from './hullPadding.js';
import { HighlightAreaParser } from './highlightAreaParser.js';
import { SVGRenderer, SVGRenderResult } from './svgRenderer.js';
import { Point, CurveType, SplineConfig, HighlightArea } from './types.js';

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

  private processHighlightArea(
    highlightAreaName: string,
    highlightAreas: HighlightArea[],
    parser: SVGParser,
    options: AnnotationOptions
  ): SVGRenderResult {
    const entities = HighlightAreaParser.getEntitiesForHighlightArea(
      highlightAreas,
      highlightAreaName
    );
    const links = HighlightAreaParser.getLinksForHighlightArea(
      highlightAreas,
      highlightAreaName
    );
    const color = HighlightAreaParser.getColorForHighlightArea(
      highlightAreas,
      highlightAreaName
    );
    const url = HighlightAreaParser.getUrlForHighlightArea(
      highlightAreas,
      highlightAreaName
    );
    const description = HighlightAreaParser.getDescriptionForHighlightArea(
      highlightAreas,
      highlightAreaName
    );
    const tooltip = HighlightAreaParser.getTooltipForHighlightArea(
      highlightAreas,
      highlightAreaName
    );

    if (options.verbose) {
      const entitiesInfo =
        entities.length > 0 ? `entities: ${entities.join(', ')}` : '';
      const linksInfo = links.length > 0 ? `links: ${links.join(', ')}` : '';
      const combinedInfo = [entitiesInfo, linksInfo].filter(Boolean).join(', ');

      console.error(
        `Processing highlight area "${highlightAreaName}" with ${combinedInfo}`
      );
    }

    const points = parser.extractPointsFromEntityGroupsAndLinks(
      entities,
      links
    );
    const hull = this.calculateHull(points, options, highlightAreaName);

    return {
      name: highlightAreaName,
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
    highlightAreas: HighlightArea[],
    highlightAreaNames: string[],
    options: AnnotationOptions,
    useAreasMode: boolean
  ): string {
    // Parse SVG once
    const parser = new SVGParser(svgPath);

    // Process each highlight area/entity group
    const results: SVGRenderResult[] = [];

    if (useAreasMode) {
      // Process each highlight area separately
      for (const highlightAreaName of highlightAreaNames) {
        results.push(
          this.processHighlightArea(
            highlightAreaName,
            highlightAreas,
            parser,
            options
          )
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
