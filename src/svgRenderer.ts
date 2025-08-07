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
   * Parse SVG viewBox and dimensions
   */
  private parseSvgDimensions(svgTag: string): {
    viewBox?: { x: number; y: number; width: number; height: number };
    width?: number;
    height?: number;
  } {
    const result: any = {};

    // Extract viewBox
    const viewBoxMatch = svgTag.match(/viewBox=["']([^"']+)["']/);
    if (viewBoxMatch) {
      const [x, y, width, height] = viewBoxMatch[1]
        .split(/\s+/)
        .map(parseFloat);
      result.viewBox = { x, y, width, height };
    }

    // Extract width and height
    const widthMatch = svgTag.match(/width=["']([^"']+)["']/);
    const heightMatch = svgTag.match(/height=["']([^"']+)["']/);
    if (widthMatch) result.width = parseFloat(widthMatch[1]);
    if (heightMatch) result.height = parseFloat(heightMatch[1]);

    return result;
  }

  /**
   * Calculate bounds of all new elements (hulls and text)
   */
  private calculateNewElementsBounds(
    results: SVGRenderResult[],
    textPositions: Array<{
      name: string;
      position: Point;
      description?: string;
    }>
  ): BoundingBox {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // Include hull points
    for (const result of results) {
      for (const point of result.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    // Include text label bounds
    for (const textPos of textPositions) {
      const fontSize = parseInt(SVGRenderer.TEXT_STYLE.fontSize);
      const fontFamily = SVGRenderer.TEXT_STYLE.fontFamily;

      // Calculate text dimensions including description
      const nameLines = textPos.name.split(/\r?\n/);
      const descriptionLines = textPos.description
        ? textPos.description.split(/\r?\n/)
        : [];

      const nameHeight = nameLines.length * fontSize * 1.2;
      const descHeight = descriptionLines.length * fontSize * 0.7 * 1.2;
      const totalHeight =
        nameHeight + (textPos.description ? 3 : 0) + descHeight;

      // Estimate text width (rough approximation)
      const maxLineWidth = Math.max(
        ...nameLines.map((line) => line.length * fontSize * 0.6),
        ...descriptionLines.map((line) => line.length * fontSize * 0.7 * 0.6)
      );

      const halfWidth = maxLineWidth / 2;
      const halfHeight = totalHeight / 2;

      minX = Math.min(minX, textPos.position.x - halfWidth);
      minY = Math.min(minY, textPos.position.y - halfHeight);
      maxX = Math.max(maxX, textPos.position.x + halfWidth);
      maxY = Math.max(maxY, textPos.position.y + halfHeight);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Adjust SVG tag to accommodate new elements
   */
  private adjustSvgViewport(
    svgTag: string,
    newBounds: BoundingBox,
    padding: number = 20
  ): string {
    const dimensions = this.parseSvgDimensions(svgTag);

    // Calculate required viewBox
    let finalViewBox: { x: number; y: number; width: number; height: number };

    if (dimensions.viewBox) {
      // Extend existing viewBox
      const current = dimensions.viewBox;
      const minX = Math.min(current.x, newBounds.x - padding);
      const minY = Math.min(current.y, newBounds.y - padding);
      const maxX = Math.max(
        current.x + current.width,
        newBounds.x + newBounds.width + padding
      );
      const maxY = Math.max(
        current.y + current.height,
        newBounds.y + newBounds.height + padding
      );

      finalViewBox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    } else {
      // Create new viewBox from scratch
      finalViewBox = {
        x: newBounds.x - padding,
        y: newBounds.y - padding,
        width: newBounds.width + 2 * padding,
        height: newBounds.height + 2 * padding,
      };
    }

    // Update the SVG tag
    let updatedTag = svgTag;

    // Update or add viewBox
    const viewBoxStr = `${finalViewBox.x} ${finalViewBox.y} ${finalViewBox.width} ${finalViewBox.height}`;
    if (dimensions.viewBox) {
      updatedTag = updatedTag.replace(
        /viewBox=["'][^"']*["']/,
        `viewBox="${viewBoxStr}"`
      );
    } else {
      updatedTag = updatedTag.replace(/<svg/, `<svg viewBox="${viewBoxStr}"`);
    }

    return updatedTag;
  }

  /**
   * Create a text or tspan element for single/multi-line text
   */
  private createTextLines(
    lines: string[],
    position: Point,
    startY: number,
    lineHeight: number,
    style: any,
    fontSize: string,
    fillOpacity: number,
    fontWeight: string,
    strokeWidth: string,
    textColor: string,
    dataAttribute: string,
    attributeValue: string
  ): string {
    if (lines.length === 1) {
      // Single line - use simple text element
      return `<text x="${position.x.toFixed(2)}" y="${startY.toFixed(2)}" text-anchor="${style.textAnchor}" dominant-baseline="${style.dominantBaseline}" font-family="${style.fontFamily}" font-size="${fontSize}" fill-opacity="${fillOpacity.toFixed(2)}" font-weight="${fontWeight}" fill="${textColor}" stroke="#000" stroke-width="${strokeWidth}" ${dataAttribute}="${attributeValue}">${lines[0]}</text>`;
    } else {
      // Multi-line - use tspan elements
      const tspans = lines
        .map((line, index) => {
          const y = startY + index * lineHeight;
          return `<tspan x="${position.x.toFixed(2)}" y="${y.toFixed(2)}">${line}</tspan>`;
        })
        .join('');
      return `<text text-anchor="${style.textAnchor}" dominant-baseline="${style.dominantBaseline}" font-family="${style.fontFamily}" font-size="${fontSize}" fill-opacity="${fillOpacity.toFixed(2)}" font-weight="${fontWeight}" fill="${textColor}" stroke="#000" stroke-width="${strokeWidth}" ${dataAttribute}="${attributeValue}">${tspans}</text>`;
    }
  }

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

    // Handle line breaks in both name and description text
    const nameLines = name.split(/\r?\n/);
    const descriptionLines = description ? description.split(/\r?\n/) : [];
    const fontSize = parseInt(style.fontSize);
    const lineHeight = fontSize * 1.2; // 20% line spacing
    const labelFontSize = Math.round(fontSize * 0.7); // 70% of main font size
    const labelLineHeight = labelFontSize * 1.2;

    // Calculate total text block height
    const nameHeight = nameLines.length * lineHeight;
    const descriptionHeight = descriptionLines.length * labelLineHeight;
    const totalHeight = nameHeight + (description ? 3 : 0) + descriptionHeight; // 3px gap between name and description

    // Calculate starting Y position to center the entire text block
    const blockStartY = position.y - totalHeight / 2 + lineHeight / 2;

    const elements: string[] = [];

    // Name text
    elements.push(
      this.createTextLines(
        nameLines,
        position,
        blockStartY,
        lineHeight,
        style,
        style.fontSize,
        textOpacity,
        style.fontWeight,
        '0.5',
        textColor,
        'data-label-for',
        name
      )
    );

    // Description text (if provided)
    if (description) {
      const descriptionStartY = blockStartY + nameHeight + 3; // 3px gap
      const descriptionOpacity = textOpacity * 0.8; // Slightly more transparent
      elements.push(
        this.createTextLines(
          descriptionLines,
          position,
          descriptionStartY,
          labelLineHeight,
          style,
          labelFontSize.toString(),
          descriptionOpacity,
          'normal',
          '0.3',
          textColor,
          'data-description-for',
          name
        )
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
    const textPositions: Array<{
      name: string;
      position: Point;
      description?: string;
    }> = [];

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

      // Store text position for viewport calculation
      textPositions.push({
        name: result.name,
        position: position,
        description: result.description,
      });

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

    // Calculate bounds of all new elements and adjust viewport if necessary
    const newElementsBounds = this.calculateNewElementsBounds(
      sortedResults,
      textPositions
    );
    const adjustedSvgTag = this.adjustSvgViewport(
      openingSvgTag,
      newElementsBounds
    );

    // Update beforePath with adjusted SVG tag
    const adjustedBeforePath =
      svgContent.substring(0, svgMatch.index!) + adjustedSvgTag;

    return `${adjustedBeforePath}\n${defsSection}\n${splinePaths.join('\n')}\n${textLabels.join('\n')}\n${afterPath}`;
  }
}
