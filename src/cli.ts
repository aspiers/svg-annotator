#!/usr/bin/env tsx

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Command } from 'commander';
import { SVGParser } from './svgParser.js';
import { HullCalculator } from './hullCalculator.js';
import { HullPadding } from './hullPadding.js';
import { FocusAreaParser } from './focusAreaParser.js';
import { SVGRenderer, SVGRenderResult } from './svgRenderer.js';
import { Point, CurveType, SplineConfig, FocusArea } from './types.js';

class SVGAnnotatorCLI {
  private program: Command;
  private svgRenderer: SVGRenderer;

  constructor() {
    this.program = new Command();
    this.svgRenderer = new SVGRenderer();
    this.setupProgram();
  }

  private setupProgram(): void {
    this.program
      .name('svg-annotator')
      .description(
        'Generate visual hull overlays around entity groups in SVG diagrams'
      )
      .version('1.0.0')
      .argument(
        '[entity-names...]',
        'Name(s) of the entities to calculate hull for (e.g., "ImpactContributor" or "Treasury FundingSource")'
      )
      .option('-s, --svg <file>', 'SVG file path', 'ERD.svg')
      .option(
        '-c, --concavity <number>',
        'Concavity parameter (lower = more concave)',
        parseFloat,
        20
      )
      .option(
        '-l, --length-threshold <number>',
        'Length threshold for edge filtering',
        parseFloat,
        0
      )
      .option(
        '--curve-type <type>',
        'Curve type: linear, catmull-rom, cardinal, basis, basis-closed',
        'catmull-rom'
      )
      .option(
        '--curve-tension <number>',
        'Tension for cardinal curves (0.0-1.0)',
        parseFloat,
        0.2
      )
      .option(
        '--curve-alpha <number>',
        'Alpha for Catmull-Rom curves (0.0-1.0)',
        parseFloat,
        0.5
      )
      .option(
        '-p, --padding <number>',
        'Padding around hull in SVG units',
        parseFloat,
        15
      )
      .option('--areas <file>', 'YAML file containing focus area definitions')
      .option('-v, --verbose', 'Verbose output', false)
      .addHelpText(
        'after',
        `
EXAMPLES:
  svg-annotator ImpactContributor
  svg-annotator ImpactContributor --curve-type cardinal --curve-tension 0.8
  svg-annotator ObjectivesDesigner --verbose
  svg-annotator Treasury --curve-type catmull-rom > treasury-spline.svg
  svg-annotator Treasury FundingSource --padding 20 > multi-entity.svg
  svg-annotator "Impact*"  # Multiple entities with pattern matching
  svg-annotator --areas focus-areas.yml Luca  # Use focus area definition
  svg-annotator --areas focus-areas.yml      # Use all focus areas

CURVE TYPES:
  linear       - Linear segments (no smoothing)
  catmull-rom  - Catmull-Rom spline (smooth, passes through all points)
  cardinal     - Cardinal spline (smooth, customizable tension)
  basis        - B-spline basis (very smooth, may not pass through points)
  basis-closed - Closed B-spline basis (smooth closed curve)

FOCUS AREAS:
  Use --areas to define reusable entity groups with custom colors.
  The YAML file should contain an array of objects with:
    name: Focus area identifier (used as argument)
    description: Human-readable description
    color: Color for the hull fill (hex like #FF0000, named like "pink", or RGB)
    areas: Array of entity names to include
    url: Optional URL to hyperlink the focus area (makes hull clickable)
    tooltip: Optional tooltip text shown on hover

The tool outputs SVG with smooth spline curve overlay.`
      );
  }

  private validateInputs(entityNames: string[], options: any): void {
    // Validate that either entity names or areas file is provided
    if (entityNames.length === 0 && !options.areas) {
      throw new Error('Either entity names or --areas file must be provided');
    }

    // Validate curve type
    const validCurveTypes: CurveType[] = [
      'linear',
      'catmull-rom',
      'cardinal',
      'basis',
      'basis-closed',
    ];
    if (!validCurveTypes.includes(options.curveType)) {
      throw new Error(
        `Invalid curve type: ${options.curveType}. Must be one of: ${validCurveTypes.join(', ')}`
      );
    }
  }

  private validateSvgFile(svgPath: string): void {
    if (!existsSync(svgPath)) {
      throw new Error(`SVG file not found: ${svgPath}`);
    }
  }

  private loadFocusAreas(
    options: any,
    entityNames: string[]
  ): { focusAreas: FocusArea[]; focusAreaNames: string[] } {
    let focusAreas: FocusArea[] = [];
    let focusAreaNames: string[] = entityNames;

    if (options.areas) {
      const areasPath = resolve(options.areas);
      if (!existsSync(areasPath)) {
        throw new Error(`Focus areas file not found: ${areasPath}`);
      }

      focusAreas = FocusAreaParser.parseFocusAreasFile(areasPath);

      // If no focus area names provided, use all focus areas
      if (entityNames.length === 0) {
        focusAreaNames = FocusAreaParser.listAvailableFocusAreas(focusAreas);
        if (options.verbose) {
          console.error(
            `No focus areas specified, using all: ${focusAreaNames.join(', ')}`
          );
        }
      }

      if (options.verbose) {
        console.error(`Focus areas file: ${areasPath}`);
        console.error(
          `Processing focus area(s): ${focusAreaNames.join(', ')}`
        );
      }
    }

    return { focusAreas, focusAreaNames };
  }

  private calculateHull(
    points: Point[],
    options: any,
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
    options: any
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
    options: any
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

  async run(): Promise<void> {
    this.program.action(async (entityNames: string[], options) => {
      try {
        // Validate inputs
        this.validateInputs(entityNames, options);

        // Resolve and validate SVG file path
        const svgPath = resolve(options.svg);
        this.validateSvgFile(svgPath);

        // Load focus areas configuration
        const { focusAreas, focusAreaNames } = this.loadFocusAreas(
          options,
          entityNames
        );

        if (options.verbose) {
          console.error(`Loading SVG file: ${svgPath}`);
          console.error(`Concavity: ${options.concavity}`);
          console.error(`Length threshold: ${options.lengthThreshold}`);
        }

        // Parse SVG once
        const parser = new SVGParser(svgPath);

        // Process each focus area/entity group
        const results: SVGRenderResult[] = [];

        if (options.areas) {
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
          type: options.curveType as CurveType,
          tension: options.curveTension,
          alpha: options.curveAlpha,
        };

        // Generate SVG output
        const output = this.svgRenderer.generateSVGOutput(
          results,
          splineConfig,
          svgContent,
          parser
        );

        console.log(output);
      } catch (error) {
        if (error instanceof Error) {
          console.error(`Error: ${error.message}`);
        } else {
          console.error('An unexpected error occurred');
        }
        process.exit(1);
      }
    });

    this.program.parse();
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new SVGAnnotatorCLI();
  cli.run();
}

export { SVGAnnotatorCLI };
