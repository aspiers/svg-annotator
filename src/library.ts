/**
 * SVG Annotator Library
 *
 * A TypeScript library for generating visual hull overlays around entity groups in SVG diagrams.
 * Provides both programmatic API and CLI interface for creating concave hulls, smooth splines,
 * and watercolor effects with text collision avoidance.
 */

// Import core classes
import { SVGParser } from './svgParser.js';
import { HullCalculator } from './hullCalculator.js';
import { SplineGenerator } from './splineGenerator.js';
import { WatercolorFilters } from './watercolorFilters.js';
import { TextCollisionDetector } from './textCollisionDetector.js';
import { HighlightAreaParser } from './highlightAreaParser.js';
import { GeometryUtils } from './geometryUtils.js';
import { ColorUtils } from './colorUtils.js';
import { HullPadding } from './hullPadding.js';

// Import types
import type {
  Point,
  BoundingBox,
  SVGElement,
  EntityGroup,
  HighlightArea,
  LinkElement,
  LinkGroup,
  ConcaveHullResult,
  CurveType,
  SplineConfig,
  SplineResult,
  TextBoundingBox,
} from './types.js';

// Core classes
export { SVGParser };
export { HullCalculator };
export { SplineGenerator };
export { WatercolorFilters };
export { TextCollisionDetector };
export { HighlightAreaParser };
export { GeometryUtils };
export { ColorUtils };
export { HullPadding };

// Type definitions
export type {
  Point,
  BoundingBox,
  SVGElement,
  EntityGroup,
  HighlightArea,
  LinkElement,
  LinkGroup,
  ConcaveHullResult,
  CurveType,
  SplineConfig,
  SplineResult,
  TextBoundingBox,
};

// Filter interfaces
export type { FilterConfig } from './watercolorFilters.js';

/**
 * High-level API for common use cases
 */
export class SVGAnnotator {
  private parser: SVGParser;
  private hullCalculator: HullCalculator;
  private splineGenerator: SplineGenerator;
  private collisionDetector: TextCollisionDetector;

  constructor(svgFilePath: string) {
    this.parser = new SVGParser(svgFilePath);
    this.hullCalculator = new HullCalculator();
    this.splineGenerator = new SplineGenerator();
    this.collisionDetector = new TextCollisionDetector(this.parser);
  }

  /**
   * Generate hull overlay for entity groups
   */
  generateHullOverlay(
    entityNames: string[],
    options: {
      concavity?: number;
      curveType?: CurveType;
      padding?: number;
      color?: string;
      enableWatercolor?: boolean;
    } = {}
  ) {
    const {
      concavity = 2,
      curveType = 'catmull-rom',
      padding = 10,
      color = '#FF0000',
      enableWatercolor = true,
    } = options;

    // Extract points from entities
    const points = this.parser.extractPointsFromEntityGroups(entityNames);

    // Add padding if specified
    const paddedPoints =
      padding > 0 ? HullPadding.addPadding(points, padding) : points;

    // Calculate hull
    const hull = this.hullCalculator.calculateConcaveHull(
      paddedPoints,
      concavity
    );

    // Generate spline
    const splineConfig = SplineGenerator.createConfig(curveType);
    const spline = this.splineGenerator.generateSpline(
      hull.points,
      splineConfig
    );

    // Generate watercolor filter if enabled
    let filterId: string | undefined;
    let filterDef: string | undefined;

    if (enableWatercolor) {
      filterId = WatercolorFilters.generateFilterId('hull');
      const filterConfig = WatercolorFilters.createDefaultConfig(hull.area);
      filterDef = WatercolorFilters.generateWatercolorFilter(
        filterId,
        filterConfig
      );
    }

    return {
      pathData: spline.pathData,
      hull,
      spline,
      filterId,
      filterDef,
      color: ColorUtils.toHex(color),
    };
  }

  /**
   * Generate multiple highlight area overlays
   */
  generateHighlightAreaOverlays(highlightAreasFilePath: string) {
    const highlightAreas = HighlightAreaParser.parseHighlightAreasFile(
      highlightAreasFilePath
    );
    const results = [];

    for (const highlightArea of highlightAreas) {
      const overlay = this.generateHullOverlay(highlightArea.areas || [], {
        color: highlightArea.color,
        enableWatercolor: true,
      });

      // Find optimal label position
      const centroid = GeometryUtils.calculateCentroid(overlay.hull.points);
      const labelPosition =
        this.collisionDetector.findNearestNonCollidingPosition(
          highlightArea.name,
          16, // fontSize
          'Arial', // fontFamily
          centroid
        );

      results.push({
        ...overlay,
        highlightArea,
        labelPosition,
      });
    }

    return results;
  }

  /**
   * Get parser for direct access to SVG parsing functionality
   */
  getParser(): SVGParser {
    return this.parser;
  }

  /**
   * Get hull calculator for direct access to hull generation
   */
  getHullCalculator(): HullCalculator {
    return this.hullCalculator;
  }

  /**
   * Get spline generator for direct access to curve generation
   */
  getSplineGenerator(): SplineGenerator {
    return this.splineGenerator;
  }

  /**
   * Get collision detector for direct access to label positioning
   */
  getCollisionDetector(): TextCollisionDetector {
    return this.collisionDetector;
  }
}
