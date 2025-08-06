import * as d3Color from 'd3-color';
import { SVGParser } from './svgParser.js';
import { SplineGenerator } from './splineGenerator.js';
import { GeometryUtils } from './geometryUtils.js';
import { WatercolorFilters } from './watercolorFilters.js';
import { TextCollisionDetector } from './textCollisionDetector.js';
import { Point, SplineConfig, BoundingBox } from './types.js';

export interface SVGRenderResult {
  name: string;
  points: Point[];
  area: number;
  perimeter: number;
  color?: string;
  url?: string;
  description?: string;
  tooltip?: string;
}

export class SVGRenderer {
  // Text label styling constants
  private static readonly TEXT_STYLE = {
    fontFamily: 'Arial, sans-serif',
    fontSize: '36',
    fillOpacity: '0.3',
    fontWeight: 'bold',
    fill: '#333',
    textAnchor: 'middle',
    dominantBaseline: 'middle',
  } as const;

  /**
   * Create a text element for hull labels
   */
  createTextElement(
    name: string,
    position: Point,
    fillColor?: string,
    description?: string
  ): string {
    const style = SVGRenderer.TEXT_STYLE;
    const textColor = fillColor
      ? this.processColorForText(fillColor)
      : style.fill;
    const textOpacity = fillColor ? 0.9 : parseFloat(style.fillOpacity); // High opacity for readability

    // Handle line breaks in name text
    const nameLines = name.split(/\r?\n/);
    const fontSize = parseInt(style.fontSize);
    const lineHeight = fontSize * 1.2; // 20% line spacing
    const labelFontSize = Math.round(fontSize * 0.7); // 70% of main font size
    const labelLineHeight = labelFontSize * 1.2;

    // Calculate total text block height
    const nameHeight = nameLines.length * lineHeight;
    const descriptionHeight = description ? labelLineHeight : 0;
    const totalHeight = nameHeight + (description ? 3 : 0) + descriptionHeight; // 3px gap between name and description

    // Calculate starting Y position to center the entire text block
    const blockStartY = position.y - totalHeight / 2 + lineHeight / 2;

    const elements: string[] = [];

    // Name text
    if (nameLines.length === 1) {
      // Single line name - use simple text element
      elements.push(
        `<text x="${position.x.toFixed(2)}" y="${blockStartY.toFixed(2)}" text-anchor="${style.textAnchor}" dominant-baseline="${style.dominantBaseline}" font-family="${style.fontFamily}" font-size="${style.fontSize}" fill-opacity="${textOpacity.toFixed(2)}" font-weight="${style.fontWeight}" fill="${textColor}" stroke="#000" stroke-width="0.5" data-label-for="${name}">${name}</text>`
      );
    } else {
      // Multi-line name - use tspan elements
      const tspans = nameLines
        .map((line, index) => {
          const y = blockStartY + index * lineHeight;
          return `<tspan x="${position.x.toFixed(2)}" y="${y.toFixed(2)}">${line}</tspan>`;
        })
        .join('');
      elements.push(
        `<text text-anchor="${style.textAnchor}" dominant-baseline="${style.dominantBaseline}" font-family="${style.fontFamily}" font-size="${style.fontSize}" fill-opacity="${textOpacity.toFixed(2)}" font-weight="${style.fontWeight}" fill="${textColor}" stroke="#000" stroke-width="0.5" data-label-for="${name}">${tspans}</text>`
      );
    }

    // Description text (if provided)
    if (description) {
      const descriptionY = blockStartY + nameHeight + 3; // 3px gap
      const descriptionOpacity = textOpacity * 0.8; // Slightly more transparent
      elements.push(
        `<text x="${position.x.toFixed(2)}" y="${descriptionY.toFixed(2)}" text-anchor="${style.textAnchor}" dominant-baseline="${style.dominantBaseline}" font-family="${style.fontFamily}" font-size="${labelFontSize}" fill-opacity="${descriptionOpacity.toFixed(2)}" font-weight="normal" fill="${textColor}" stroke="#000" stroke-width="0.3" data-description-for="${name}">${description}</text>`
      );
    }

    return elements.join('\n');
  }

  /**
   * Process hull fill color to make it more readable as text
   * Uses d3-color utilities to darken and desaturate the color
   */
  private processColorForText(color: string): string {
    try {
      // Parse the color using d3-color
      const parsedColor = d3Color.color(color);
      if (!parsedColor) {
        return '#374151'; // Dark gray fallback
      }

      // Convert to HSL for easier manipulation
      const hslColor = d3Color.hsl(parsedColor);

      // Reduce saturation by 20% and lightness by 40% for better readability
      hslColor.s *= 0.8;
      hslColor.l = Math.max(0.2, hslColor.l * 0.6); // Ensure minimum lightness

      return hslColor.toString();
    } catch (error) {
      // Fallback to dark gray if color parsing fails
      return '#374151';
    }
  }

  /**
   * Generate SVG output with hull paths and text labels
   */
  generateSVGOutput(
    results: SVGRenderResult[],
    splineConfig: SplineConfig,
    svgContent?: string,
    parser?: SVGParser
  ): string {
    if (!svgContent) {
      // Return standalone SVG elements with watercolor filters
      const splineGenerator = new SplineGenerator();
      const elements: string[] = [];
      const filterConfigs: Array<{ id: string; config: any; name: string }> =
        [];

      // Generate filter configurations for each result
      const pathElements: string[] = [];
      const existingBoxes: BoundingBox[] = [];

      // Sort results by area (largest first) to give priority to bigger hulls
      const sortedResults = [...results].sort((a, b) => b.area - a.area);

      for (const result of sortedResults) {
        const splineResult = splineGenerator.generateSpline(
          result.points,
          splineConfig
        );
        const fillColor = result.color || '#E5F3FF';
        const area = WatercolorFilters.calculateHullArea(result.points);

        // Create unique filter ID and configuration
        const filterId = WatercolorFilters.generateFilterId(result.name);
        const filterConfig = WatercolorFilters.createDefaultConfig(area, true);
        filterConfigs.push({
          id: filterId,
          config: filterConfig,
          name: result.name,
        });

        // Create single path with watercolor filter, transparency, and blend mode
        const tooltipElement = result.tooltip
          ? `<title>${result.tooltip}</title>`
          : '';
        const pathElement = `<path d="${splineResult.pathData}" fill="${fillColor}" fill-opacity="0.9" stroke="none" filter="url(#${filterId})" style="mix-blend-mode: multiply;" data-hull-entity="${result.name}" data-curve-type="${splineConfig.type}">${tooltipElement}</path>`;

        if (result.url) {
          pathElements.push(
            `<a href="${result.url}" xlink:href="${result.url}">${pathElement}</a>`
          );
        } else {
          pathElements.push(pathElement);
        }

        // Add text label with collision avoidance
        const centroid = GeometryUtils.calculateCentroid(result.points);
        const fontSize = parseInt(SVGRenderer.TEXT_STYLE.fontSize);
        const fontFamily = SVGRenderer.TEXT_STYLE.fontFamily;

        const position = GeometryUtils.findNearestNonCollidingPosition(
          result.name,
          fontSize,
          fontFamily,
          centroid,
          existingBoxes
        );

        // Add this text's bounding box to existing boxes for future collision checks
        const textDimensions = GeometryUtils.calculateBoundingBox(
          result.name,
          fontSize,
          fontFamily
        );
        existingBoxes.push({
          x: position.x - textDimensions.width / 2 - 5,
          y: position.y - textDimensions.height / 2 - 5,
          width: textDimensions.width + 10,
          height: textDimensions.height + 10,
        });

        const textElement = this.createTextElement(
          result.name,
          position,
          fillColor,
          result.description
        );
        pathElements.push(textElement);
      }

      // Generate defs section with filters
      const defsSection = WatercolorFilters.generateDefsSection(filterConfigs);
      elements.push(defsSection);
      elements.push(...pathElements);

      return elements.join('\n');
    }

    // Insert watercolor filters and paths into existing SVG
    const svgMatch = svgContent.match(/<svg[^>]*>/);
    if (!svgMatch) {
      throw new Error('Invalid SVG: missing opening <svg> tag');
    }

    const openingSvgTag = svgMatch[0];
    const openingSvgIndex = svgMatch.index! + openingSvgTag.length;

    const beforePath = svgContent.substring(0, openingSvgIndex);
    const afterPath = svgContent.substring(openingSvgIndex);

    const splineGenerator = new SplineGenerator();
    const filterConfigs: Array<{ id: string; config: any; name: string }> = [];
    const splinePaths: string[] = [];
    const textLabels: string[] = [];

    // Initialize collision detection if parser is provided
    let collisionDetector: TextCollisionDetector | null = null;
    let existingBoxes: BoundingBox[] = [];

    if (parser) {
      collisionDetector = new TextCollisionDetector(parser);
      existingBoxes = collisionDetector.extractExistingSvgElements();
    }

    // Sort results by area (largest first) to give priority to bigger hulls
    const sortedResults = [...results].sort((a, b) => b.area - a.area);

    // Generate filters and paths for each result
    for (const result of sortedResults) {
      const splineResult = splineGenerator.generateSpline(
        result.points,
        splineConfig
      );
      const fillColor = result.color || '#E5F3FF';
      const area = WatercolorFilters.calculateHullArea(result.points);

      // Create unique filter ID and configuration
      const filterId = WatercolorFilters.generateFilterId(result.name);
      const filterConfig = WatercolorFilters.createDefaultConfig(area, true);
      filterConfigs.push({
        id: filterId,
        config: filterConfig,
        name: result.name,
      });

      splinePaths.push(
        `<!-- Watercolor spline hull for ${result.name} (with SVG filters) -->`
      );

      // Create single path with watercolor filter, transparency, and blend mode
      const tooltipElement = result.tooltip
        ? `<title>${result.tooltip}</title>`
        : '';
      const pathElement = `<path d="${splineResult.pathData}" fill="${fillColor}" fill-opacity="0.9" stroke="none" filter="url(#${filterId})" style="mix-blend-mode: multiply;" data-hull-entity="${result.name}" data-curve-type="${splineConfig.type}">${tooltipElement}</path>`;

      if (result.url) {
        splinePaths.push(
          `<a href="${result.url}" xlink:href="${result.url}">${pathElement}</a>`
        );
      } else {
        splinePaths.push(pathElement);
      }

      // Calculate position for text label with collision avoidance
      const centroid = GeometryUtils.calculateCentroid(result.points);
      let position = centroid;

      if (collisionDetector) {
        const fontSize = parseInt(SVGRenderer.TEXT_STYLE.fontSize);
        const fontFamily = SVGRenderer.TEXT_STYLE.fontFamily;

        position = collisionDetector.findNearestNonCollidingPosition(
          result.name,
          fontSize,
          fontFamily,
          centroid
        );
      } else {
        // Fallback to GeometryUtils if no parser provided
        const fontSize = parseInt(SVGRenderer.TEXT_STYLE.fontSize);
        const fontFamily = SVGRenderer.TEXT_STYLE.fontFamily;

        position = GeometryUtils.findNearestNonCollidingPosition(
          result.name,
          fontSize,
          fontFamily,
          centroid,
          existingBoxes
        );

        // Add this text's bounding box to existing boxes for future collision checks
        const textDimensions = GeometryUtils.calculateBoundingBox(
          result.name,
          fontSize,
          fontFamily
        );
        existingBoxes.push({
          x: position.x - textDimensions.width / 2 - 5,
          y: position.y - textDimensions.height / 2 - 5,
          width: textDimensions.width + 10,
          height: textDimensions.height + 10,
        });
      }

      const textElement = this.createTextElement(
        result.name,
        position,
        fillColor,
        result.description
      );
      textLabels.push(`<!-- Text label for ${result.name} -->`);
      textLabels.push(textElement);
    }

    // Generate defs section with all watercolor filters
    const defsSection = WatercolorFilters.generateDefsSection(filterConfigs);

    return `${beforePath}\n${defsSection}\n${splinePaths.join('\n')}\n${textLabels.join('\n')}\n${afterPath}`;
  }
}
