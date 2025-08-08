import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { HighlightArea } from './types.js';
import { ColorUtils } from './colorUtils.js';

export class HighlightAreaParser {
  static parseHighlightAreasFile(filePath: string): HighlightArea[] {
    try {
      const yamlContent = readFileSync(filePath, 'utf-8');
      const highlightAreas = yaml.load(yamlContent) as HighlightArea[];

      if (!Array.isArray(highlightAreas)) {
        throw new Error(
          'Highlight areas file must contain an array of highlight area objects'
        );
      }

      // Validate each highlight area
      for (let i = 0; i < highlightAreas.length; i++) {
        const area = highlightAreas[i];
        if (!area.name || typeof area.name !== 'string') {
          throw new Error(
            `Highlight area at index ${i} must have a "name" field`
          );
        }
        if (!area.color || typeof area.color !== 'string') {
          throw new Error(
            `Highlight area "${area.name}" must have a "color" field (got: ${JSON.stringify(area.color)})`
          );
        }
        if (!ColorUtils.isValidColor(area.color)) {
          throw new Error(
            `Highlight area "${area.name}" has invalid color "${area.color}". Use hex colors (#FF0000), named colors (red, pink, blue), or RGB format (rgb(255,0,0))`
          );
        }
        if (area.areas !== undefined && !Array.isArray(area.areas)) {
          throw new Error(
            `Highlight area "${area.name}" areas field must be an array if provided`
          );
        }
        if (area.links && !Array.isArray(area.links)) {
          throw new Error(
            `Highlight area "${area.name}" links field must be an array if provided`
          );
        }
        if (area.url && typeof area.url !== 'string') {
          throw new Error(
            `Highlight area "${area.name}" url field must be a string if provided`
          );
        }
        // Validate that at least areas or links are provided
        const hasAreas =
          area.areas && Array.isArray(area.areas) && area.areas.length > 0;
        const hasLinks =
          area.links && Array.isArray(area.links) && area.links.length > 0;
        if (!hasAreas && !hasLinks) {
          throw new Error(
            `Highlight area "${area.name}" must have either "areas" or "links" (or both) with at least one item`
          );
        }
      }

      return highlightAreas;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to parse highlight areas file "${filePath}": ${error.message}`
        );
      }
      throw new Error(
        `Failed to parse highlight areas file "${filePath}": Unknown error`
      );
    }
  }

  /**
   * Filter highlight areas by name patterns
   * Supports exact matches and wildcard patterns (e.g., "Impact*")
   * @param highlightAreas All available highlight areas
   * @param filters Array of filter patterns to match against
   * @returns Filtered highlight areas that match any of the filters
   */
  static filterHighlightAreas(
    highlightAreas: HighlightArea[],
    filters: string[]
  ): HighlightArea[] {
    if (filters.length === 0) {
      return highlightAreas;
    }

    return highlightAreas.filter((area) => {
      return filters.some((filter) => {
        // Exact match
        if (filter === area.name) {
          return true;
        }
        // Pattern matching with wildcards
        if (filter.includes('*')) {
          const regex = new RegExp(
            '^' + filter.replace(/\*/g, '.*') + '$',
            'i'
          );
          return regex.test(area.name);
        }
        return false;
      });
    });
  }

  /**
   * Get all unique area names from highlight areas
   */
  static getAllAreaNames(highlightAreas: HighlightArea[]): string[] {
    return highlightAreas.map((area) => area.name);
  }

  /**
   * Validate link identifiers against available links in SVG
   * This can be used to validate configuration files
   */
  static validateLinks(
    highlightAreas: HighlightArea[],
    availableLinks: Array<{
      linkId: string;
      sourceEntity: string;
      targetEntity: string;
      label?: string;
    }>
  ): string[] {
    const validationErrors: string[] = [];
    const availableLinkIds = new Set(availableLinks.map((l) => l.linkId));
    const entityPairs = new Set(
      availableLinks.map((l) => `${l.sourceEntity}-${l.targetEntity}`)
    );
    const labels = new Set(availableLinks.map((l) => l.label).filter(Boolean));

    for (const area of highlightAreas) {
      if (!area.links) continue;

      for (const linkSpec of area.links) {
        // Check if it's a direct link ID
        if (availableLinkIds.has(linkSpec)) {
          continue;
        }

        // Check if it matches entity pairs (e.g., "Entity1-Entity2")
        if (entityPairs.has(linkSpec)) {
          continue;
        }

        // Check if it matches a label
        if (labels.has(linkSpec)) {
          continue;
        }

        // Check if it's a pattern
        if (linkSpec.includes('*')) {
          const regex = new RegExp(
            '^' + linkSpec.replace(/\*/g, '.*') + '$',
            'i'
          );
          const hasMatch = availableLinks.some(
            (link) =>
              regex.test(link.linkId) ||
              regex.test(`${link.sourceEntity}-${link.targetEntity}`) ||
              (link.label && regex.test(link.label))
          );
          if (hasMatch) {
            continue;
          }
        }

        validationErrors.push(
          `Highlight area "${area.name}" references unknown link "${linkSpec}"`
        );
      }
    }

    return validationErrors;
  }
}
