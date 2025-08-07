import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import {
  Point,
  BoundingBox,
  SVGElement,
  EntityGroup,
  LinkElement,
  LinkGroup,
} from './types.js';

export class SVGParser {
  private dom: JSDOM;
  private svgElement: Element;

  constructor(svgFilePath: string) {
    const svgContent = readFileSync(svgFilePath, 'utf-8');
    this.dom = new JSDOM(svgContent, { contentType: 'image/svg+xml' });
    const svg = this.dom.window.document.querySelector('svg');
    if (!svg) {
      throw new Error('No SVG element found in the file');
    }
    this.svgElement = svg;
  }

  /**
   * Find the group element with the specified data-entity attribute
   */
  findEntityGroup(entityName: string): Element | null {
    return this.svgElement.querySelector(`g[data-entity="${entityName}"]`);
  }

  /**
   * Get all elements inside an entity group
   */
  getElementsInGroup(groupElement: Element): SVGElement[] {
    const elements: SVGElement[] = [];
    const allElements = groupElement.querySelectorAll('*');

    for (const element of allElements) {
      const bbox = this.getElementBoundingBox(element);
      if (bbox) {
        elements.push({
          tagName: element.tagName.toLowerCase(),
          attributes: this.getElementAttributes(element),
          bbox,
        });
      }
    }

    return elements;
  }

  /**
   * Extract bounding box information from an SVG element
   */
  private getElementBoundingBox(element: Element): BoundingBox | null {
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
      case 'rect':
        return this.getRectBoundingBox(element);
      case 'circle':
      case 'ellipse':
        return this.getCircleEllipseBoundingBox(element);
      case 'path':
        return this.getPathBoundingBox(element);
      case 'line':
        return this.getLineBoundingBox(element);
      case 'text':
        return this.getTextBoundingBox(element);
      default:
        // For other elements, try to get generic position info
        return this.getGenericBoundingBox(element);
    }
  }

  private getRectBoundingBox(element: Element): BoundingBox {
    const x = parseFloat(element.getAttribute('x') || '0');
    const y = parseFloat(element.getAttribute('y') || '0');
    const width = parseFloat(element.getAttribute('width') || '0');
    const height = parseFloat(element.getAttribute('height') || '0');

    return { x, y, width, height };
  }

  private getCircleEllipseBoundingBox(element: Element): BoundingBox {
    if (element.tagName.toLowerCase() === 'circle') {
      const cx = parseFloat(element.getAttribute('cx') || '0');
      const cy = parseFloat(element.getAttribute('cy') || '0');
      const r = parseFloat(element.getAttribute('r') || '0');

      return {
        x: cx - r,
        y: cy - r,
        width: r * 2,
        height: r * 2,
      };
    } else {
      // ellipse
      const cx = parseFloat(element.getAttribute('cx') || '0');
      const cy = parseFloat(element.getAttribute('cy') || '0');
      const rx = parseFloat(element.getAttribute('rx') || '0');
      const ry = parseFloat(element.getAttribute('ry') || '0');

      return {
        x: cx - rx,
        y: cy - ry,
        width: rx * 2,
        height: ry * 2,
      };
    }
  }

  private getLineBoundingBox(element: Element): BoundingBox {
    const x1 = parseFloat(element.getAttribute('x1') || '0');
    const y1 = parseFloat(element.getAttribute('y1') || '0');
    const x2 = parseFloat(element.getAttribute('x2') || '0');
    const y2 = parseFloat(element.getAttribute('y2') || '0');

    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private getTextBoundingBox(element: Element): BoundingBox {
    const x = parseFloat(element.getAttribute('x') || '0');
    const y = parseFloat(element.getAttribute('y') || '0');
    // Estimate text dimensions (rough approximation)
    const textLength = parseFloat(element.getAttribute('textLength') || '0');
    const fontSize = 14; // Default font size from the SVG

    return {
      x,
      y: y - fontSize,
      width: textLength || (element.textContent?.length || 0) * fontSize * 0.6,
      height: fontSize,
    };
  }

  private getPathBoundingBox(element: Element): BoundingBox | null {
    const d = element.getAttribute('d');
    if (!d) return null;

    // Simple path parsing - extract coordinates
    const coords = this.extractPathCoordinates(d);
    if (coords.length === 0) return null;

    const xs = coords.map((p) => p.x);
    const ys = coords.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private getGenericBoundingBox(element: Element): BoundingBox | null {
    // Try to extract x, y attributes if they exist
    const x = element.getAttribute('x');
    const y = element.getAttribute('y');

    if (x !== null && y !== null) {
      return {
        x: parseFloat(x),
        y: parseFloat(y),
        width: 0,
        height: 0,
      };
    }

    return null;
  }

  private extractPathCoordinates(pathData: string): Point[] {
    const points: Point[] = [];
    // Simple regex to extract numbers (coordinates)
    const numbers = pathData.match(/-?\d+\.?\d*/g);

    if (numbers) {
      for (let i = 0; i < numbers.length - 1; i += 2) {
        points.push({
          x: parseFloat(numbers[i]),
          y: parseFloat(numbers[i + 1]),
        });
      }
    }

    return points;
  }

  private getElementAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};

    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }

    return attributes;
  }

  /**
   * Extract all corner points from elements in an entity group
   */
  extractPointsFromEntityGroup(entityName: string): Point[] {
    const group = this.findEntityGroup(entityName);
    if (!group) {
      throw new Error(`Entity group "${entityName}" not found`);
    }

    const elements = this.getElementsInGroup(group);
    const points: Point[] = [];

    for (const element of elements) {
      const bbox = element.bbox;
      // Add all four corners of each element's bounding box
      points.push(
        { x: bbox.x, y: bbox.y }, // top-left
        { x: bbox.x + bbox.width, y: bbox.y }, // top-right
        { x: bbox.x + bbox.width, y: bbox.y + bbox.height }, // bottom-right
        { x: bbox.x, y: bbox.y + bbox.height } // bottom-left
      );
    }

    return points;
  }

  /**
   * Extract all corner points from elements in multiple entity groups
   */
  extractPointsFromEntityGroups(entityNames: string[]): Point[] {
    const allPoints: Point[] = [];
    const foundEntities: string[] = [];
    const notFoundEntities: string[] = [];

    for (const entityName of entityNames) {
      // Support wildcard patterns
      if (entityName.includes('*')) {
        const matchingEntities = this.findEntitiesMatchingPattern(entityName);
        if (matchingEntities.length === 0) {
          notFoundEntities.push(entityName);
        } else {
          for (const matchedEntity of matchingEntities) {
            const points = this.extractPointsFromEntityGroup(matchedEntity);
            allPoints.push(...points);
            foundEntities.push(matchedEntity);
          }
        }
      } else {
        try {
          const points = this.extractPointsFromEntityGroup(entityName);
          allPoints.push(...points);
          foundEntities.push(entityName);
        } catch (error) {
          notFoundEntities.push(entityName);
        }
      }
    }

    if (notFoundEntities.length > 0) {
      throw new Error(
        `Entity groups not found: ${notFoundEntities.join(', ')}`
      );
    }

    if (allPoints.length === 0) {
      throw new Error('No points found in any of the specified entity groups');
    }

    return allPoints;
  }

  /**
   * Find entities matching a wildcard pattern
   */
  private findEntitiesMatchingPattern(pattern: string): string[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
    const allGroups = this.svgElement.querySelectorAll('g[data-entity]');
    const matchingEntities: string[] = [];

    for (const group of allGroups) {
      const entityName = group.getAttribute('data-entity');
      if (entityName && regex.test(entityName)) {
        matchingEntities.push(entityName);
      }
    }

    return matchingEntities;
  }

  /**
   * Get entity group information
   */
  getEntityGroupInfo(entityName: string): EntityGroup {
    const group = this.findEntityGroup(entityName);
    if (!group) {
      throw new Error(`Entity group "${entityName}" not found`);
    }

    const elements = this.getElementsInGroup(group);

    // Calculate overall bounding box
    if (elements.length === 0) {
      throw new Error(`No elements found in entity group "${entityName}"`);
    }

    const allX = elements.flatMap((e) => [e.bbox.x, e.bbox.x + e.bbox.width]);
    const allY = elements.flatMap((e) => [e.bbox.y, e.bbox.y + e.bbox.height]);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);

    return {
      entityName,
      elements,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
    };
  }

  /**
   * Get all text elements from the SVG
   */
  getAllTextElements(): SVGElement[] {
    const textElements: SVGElement[] = [];
    const allTexts = this.svgElement.querySelectorAll('text');

    for (const textElement of allTexts) {
      const bbox = this.getElementBoundingBox(textElement);
      if (bbox) {
        textElements.push({
          tagName: textElement.tagName.toLowerCase(),
          attributes: this.getElementAttributes(textElement),
          bbox,
        });
      }
    }

    return textElements;
  }

  /**
   * Get all elements from the SVG (for collision detection)
   */
  getAllElements(): SVGElement[] {
    const elements: SVGElement[] = [];
    const allElements = this.svgElement.querySelectorAll('*');

    for (const element of allElements) {
      // Skip the root SVG element and group containers
      if (
        element.tagName.toLowerCase() === 'svg' ||
        element.tagName.toLowerCase() === 'g'
      ) {
        continue;
      }

      const bbox = this.getElementBoundingBox(element);
      if (bbox) {
        elements.push({
          tagName: element.tagName.toLowerCase(),
          attributes: this.getElementAttributes(element),
          bbox,
        });
      }
    }

    return elements;
  }

  /**
   * Find link elements by link ID, entity names, or label text
   * Note: For PlantUML, multiple links between same entities may have same ID
   * but different data-uid attributes
   */
  findLinkElement(linkId: string): Element | null {
    // Try to find by ID attribute
    const linkElement = this.svgElement.querySelector(`g.link[id="${linkId}"]`);
    return linkElement;
  }

  /**
   * Find all link elements with a given ID (handles duplicate IDs)
   */
  findAllLinkElementsById(linkId: string): Element[] {
    const allLinks = this.svgElement.querySelectorAll('g.link');
    const matchingLinks: Element[] = [];

    for (const link of allLinks) {
      if (link.getAttribute('id') === linkId) {
        matchingLinks.push(link);
      }
    }

    return matchingLinks;
  }

  /**
   * Find link elements by connected entity names
   */
  findLinksByEntityNames(entity1: string, entity2: string): Element[] {
    const linkElements: Element[] = [];
    const allLinks = this.svgElement.querySelectorAll('g.link');

    for (const link of allLinks) {
      const sourceEntity = link.getAttribute('data-entity-1');
      const targetEntity = link.getAttribute('data-entity-2');

      // Check both directions
      if (
        (sourceEntity === entity1 && targetEntity === entity2) ||
        (sourceEntity === entity2 && targetEntity === entity1)
      ) {
        linkElements.push(link);
      }
    }

    return linkElements;
  }

  /**
   * Find link elements by label text
   */
  findLinksByLabel(labelText: string): Element[] {
    const linkElements: Element[] = [];
    const allLinks = this.svgElement.querySelectorAll('g.link');

    for (const link of allLinks) {
      const textElements = link.querySelectorAll('text');
      for (const text of textElements) {
        if (
          text.textContent &&
          text.textContent.toLowerCase().includes(labelText.toLowerCase())
        ) {
          linkElements.push(link);
          break;
        }
      }
    }

    return linkElements;
  }

  /**
   * Find all link elements
   */
  findAllLinks(): Element[] {
    return Array.from(this.svgElement.querySelectorAll('g.link'));
  }

  /**
   * Extract points from a link element
   * Supports both simple IDs and composite IDs with UID (e.g., "link_A_B[lnk123]")
   */
  extractPointsFromLink(linkSpec: string): Point[] {
    let linkElement: Element | null = null;

    // Check if this is a composite ID with UID
    const uidMatch = linkSpec.match(/^(.+)\[(.+)\]$/);
    if (uidMatch) {
      const [, linkId, uid] = uidMatch;
      const allLinks = this.svgElement.querySelectorAll('g.link');

      for (const link of allLinks) {
        if (
          link.getAttribute('id') === linkId &&
          link.getAttribute('data-uid') === uid
        ) {
          linkElement = link;
          break;
        }
      }
    } else {
      // Simple ID lookup
      linkElement = this.findLinkElement(linkSpec);
    }

    if (!linkElement) {
      throw new Error(`Link "${linkSpec}" not found`);
    }

    return this.extractPointsFromLinkElement(linkElement);
  }

  /**
   * Extract points from a PlantUML link element
   */
  private extractPointsFromLinkElement(linkElement: Element): Point[] {
    const points: Point[] = [];

    // Extract points from path elements
    const pathElements = linkElement.querySelectorAll('path');
    for (const path of pathElements) {
      const d = path.getAttribute('d');
      if (d) {
        const pathPoints = this.extractPathCoordinates(d);
        points.push(...pathPoints);
      }
    }

    // Extract points from line elements
    const lineElements = linkElement.querySelectorAll('line');
    for (const line of lineElements) {
      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');

      // Add intermediate points along the line for better hull coverage
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        points.push({
          x: x1 + (x2 - x1) * t,
          y: y1 + (y2 - y1) * t,
        });
      }
    }

    // Extract points from polygon elements (arrowheads)
    const polygonElements = linkElement.querySelectorAll('polygon');
    for (const polygon of polygonElements) {
      const pointsAttr = polygon.getAttribute('points');
      if (pointsAttr) {
        const polygonPoints = this.parsePolygonPoints(pointsAttr);
        points.push(...polygonPoints);
      }
    }

    return points;
  }

  /**
   * Parse polygon points attribute
   */
  private parsePolygonPoints(pointsAttr: string): Point[] {
    const points: Point[] = [];
    const coords = pointsAttr
      .split(/[\s,]+/)
      .map((s) => parseFloat(s))
      .filter((n) => !isNaN(n));

    for (let i = 0; i < coords.length - 1; i += 2) {
      points.push({
        x: coords[i],
        y: coords[i + 1],
      });
    }

    return points;
  }

  /**
   * Extract detailed points from path or line elements
   */
  private extractDetailedPointsFromElement(
    element: Element,
    tagName: string
  ): Point[] {
    const points: Point[] = [];

    if (tagName === 'path') {
      const d = element.getAttribute('d');
      if (d) {
        points.push(...this.extractPathCoordinates(d));
      }
    } else if (tagName === 'line') {
      const x1 = parseFloat(element.getAttribute('x1') || '0');
      const y1 = parseFloat(element.getAttribute('y1') || '0');
      const x2 = parseFloat(element.getAttribute('x2') || '0');
      const y2 = parseFloat(element.getAttribute('y2') || '0');

      // Add intermediate points along the line for better hull coverage
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        points.push({
          x: x1 + (x2 - x1) * t,
          y: y1 + (y2 - y1) * t,
        });
      }
    }

    return points;
  }

  /**
   * Extract points from bounding box corners
   */
  private extractPointsFromBoundingBox(bbox: BoundingBox): Point[] {
    return [
      { x: bbox.x, y: bbox.y }, // top-left
      { x: bbox.x + bbox.width, y: bbox.y }, // top-right
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height }, // bottom-right
      { x: bbox.x, y: bbox.y + bbox.height }, // bottom-left
    ];
  }

  /**
   * Get link element information
   * Supports both simple IDs and composite IDs with UID (e.g., "link_A_B[lnk123]")
   */
  getLinkInfo(linkSpec: string): LinkGroup {
    let linkElement: Element | null = null;

    // Check if this is a composite ID with UID
    const uidMatch = linkSpec.match(/^(.+)\[(.+)\]$/);
    if (uidMatch) {
      const [, linkId, uid] = uidMatch;
      const allLinks = this.svgElement.querySelectorAll('g.link');

      for (const link of allLinks) {
        if (
          link.getAttribute('id') === linkId &&
          link.getAttribute('data-uid') === uid
        ) {
          linkElement = link;
          break;
        }
      }
    } else {
      // Simple ID lookup
      linkElement = this.findLinkElement(linkSpec);
    }

    if (!linkElement) {
      throw new Error(`Link "${linkSpec}" not found`);
    }

    const sourceEntity = linkElement.getAttribute('data-entity-1') || '';
    const targetEntity = linkElement.getAttribute('data-entity-2') || '';

    // Extract label from text elements
    let label: string | undefined;
    const textElements = linkElement.querySelectorAll('text');
    if (textElements.length > 0) {
      label = Array.from(textElements)
        .map((text) => text.textContent || '')
        .join(' ')
        .trim();
    }

    const elements = this.getElementsInGroup(linkElement);
    const points = this.extractPointsFromLinkElement(linkElement);

    if (elements.length === 0) {
      throw new Error(`No elements found in link "${linkSpec}"`);
    }

    // Calculate overall bounding box
    const allX = elements.flatMap((e) => [e.bbox.x, e.bbox.x + e.bbox.width]);
    const allY = elements.flatMap((e) => [e.bbox.y, e.bbox.y + e.bbox.height]);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);

    return {
      linkId: linkSpec,
      sourceEntity,
      targetEntity,
      label,
      elements,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      points,
    };
  }

  /**
   * Extract points from multiple links
   */
  extractPointsFromLinks(linkSpecs: string[]): Point[] {
    const allPoints: Point[] = [];
    const foundLinks: string[] = [];
    const notFoundLinks: string[] = [];

    for (const linkSpec of linkSpecs) {
      const matchingLinks = this.findLinksBySpecification(linkSpec);

      if (matchingLinks.length === 0) {
        notFoundLinks.push(linkSpec);
      } else {
        for (const matchedLinkId of matchingLinks) {
          try {
            const points = this.extractPointsFromLink(matchedLinkId);
            allPoints.push(...points);
            foundLinks.push(matchedLinkId);
          } catch (error) {
            notFoundLinks.push(matchedLinkId);
          }
        }
      }
    }

    if (notFoundLinks.length > 0) {
      throw new Error(`Links not found: ${notFoundLinks.join(', ')}`);
    }

    return allPoints;
  }

  /**
   * Find links matching a wildcard pattern
   */
  private findLinksMatchingPattern(pattern: string): string[] {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
    const allLinkElements = this.svgElement.querySelectorAll('g.link');
    const matchingLinks: string[] = [];

    for (const element of allLinkElements) {
      const linkId = element.getAttribute('id');
      if (linkId && regex.test(linkId)) {
        matchingLinks.push(linkId);
      }
    }

    return matchingLinks;
  }

  /**
   * Find links by entity name pattern or label pattern
   */
  findLinksByPattern(pattern: string): string[] {
    const matchingLinks: string[] = [];
    const allLinkElements = this.svgElement.querySelectorAll('g.link');

    for (const element of allLinkElements) {
      const linkId = element.getAttribute('id') || '';
      const sourceEntity = element.getAttribute('data-entity-1') || '';
      const targetEntity = element.getAttribute('data-entity-2') || '';

      // Get label text
      let label = '';
      const textElements = element.querySelectorAll('text');
      if (textElements.length > 0) {
        label = Array.from(textElements)
          .map((text) => text.textContent || '')
          .join(' ')
          .trim();
      }

      // Check if pattern matches link ID, entity names, or label
      const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
      if (
        regex.test(linkId) ||
        regex.test(sourceEntity) ||
        regex.test(targetEntity) ||
        regex.test(label) ||
        regex.test(`${sourceEntity}-${targetEntity}`) ||
        regex.test(`${targetEntity}-${sourceEntity}`)
      ) {
        matchingLinks.push(linkId);
      }
    }

    return matchingLinks;
  }

  /**
   * Find links by combined entity pair and label specification
   * Supports format: "Entity1-Entity2:labelText" or "Entity1-Entity2:*pattern*"
   * Returns unique identifiers that can distinguish between multiple links with same ID
   */
  findLinksByEntityPairAndLabel(
    entityPair: string,
    labelPattern: string
  ): string[] {
    const matchingLinks: string[] = [];
    const allLinkElements = this.svgElement.querySelectorAll('g.link');

    // Parse entity pair (support both directions)
    const [entity1, entity2] = entityPair.split('-');
    if (!entity1 || !entity2) {
      return matchingLinks;
    }

    for (const element of allLinkElements) {
      const sourceEntity = element.getAttribute('data-entity-1') || '';
      const targetEntity = element.getAttribute('data-entity-2') || '';

      // Check if entities match (either direction)
      const entitiesMatch =
        (sourceEntity === entity1 && targetEntity === entity2) ||
        (sourceEntity === entity2 && targetEntity === entity1);

      if (!entitiesMatch) {
        continue;
      }

      // Get label text
      let label = '';
      const textElements = element.querySelectorAll('text');
      if (textElements.length > 0) {
        label = Array.from(textElements)
          .map((text) => text.textContent || '')
          .join(' ')
          .trim();
      }

      // Check if label matches pattern
      const regex = new RegExp(labelPattern.replace(/\*/g, '.*'), 'i');
      if (regex.test(label)) {
        const linkId = element.getAttribute('id') || '';
        const uid = element.getAttribute('data-uid') || '';

        // Create a unique identifier combining ID and UID for disambiguation
        const uniqueId = uid ? `${linkId}[${uid}]` : linkId;
        matchingLinks.push(uniqueId);
      }
    }

    return matchingLinks;
  }

  /**
   * Parse link specification and find matching links
   * Supports multiple formats:
   * - "link_Entity1_Entity2" (direct ID)
   * - "Entity1-Entity2" (entity pair)
   * - "Entity1-Entity2:labelText" (entity pair with label)
   * - "Entity1-Entity2:*pattern*" (entity pair with label pattern)
   * - "labelText" (label only)
   * - "*pattern*" (pattern matching)
   */
  findLinksBySpecification(linkSpec: string): string[] {
    // Check for combined entity-pair:label format
    if (linkSpec.includes(':')) {
      const colonIndex = linkSpec.indexOf(':');
      const entityPart = linkSpec.substring(0, colonIndex);
      const labelPart = linkSpec.substring(colonIndex + 1);

      // Only treat as entity-pair:label if entity part looks like "Entity1-Entity2"
      if (entityPart.includes('-') && !entityPart.startsWith('link_')) {
        return this.findLinksByEntityPairAndLabel(entityPart, labelPart);
      }
    }

    // Try direct link ID first
    const directLink = this.findLinkElement(linkSpec);
    if (directLink) {
      const linkId = directLink.getAttribute('id');
      return linkId ? [linkId] : [];
    }

    // Try entity pair format (without colon)
    if (
      linkSpec.includes('-') &&
      !linkSpec.startsWith('link_') &&
      !linkSpec.includes('*')
    ) {
      const [entity1, entity2] = linkSpec.split('-');
      if (entity1 && entity2) {
        const links = this.findLinksByEntityNames(entity1, entity2);
        return links
          .map((link) => link.getAttribute('id') || '')
          .filter(Boolean);
      }
    }

    // Try pattern matching or label matching
    if (linkSpec.includes('*')) {
      return this.findLinksByPattern(linkSpec);
    } else {
      // Try label matching
      const labelLinks = this.findLinksByLabel(linkSpec);
      return labelLinks
        .map((link) => link.getAttribute('id') || '')
        .filter(Boolean);
    }
  }

  /**
   * Extract points from both entities and links
   */
  extractPointsFromEntityGroupsAndLinks(
    entityNames: string[],
    linkIds: string[]
  ): Point[] {
    const allPoints: Point[] = [];

    // Extract points from entity groups
    if (entityNames.length > 0) {
      const entityPoints = this.extractPointsFromEntityGroups(entityNames);
      allPoints.push(...entityPoints);
    }

    // Extract points from links
    if (linkIds.length > 0) {
      const linkPoints = this.extractPointsFromLinks(linkIds);
      allPoints.push(...linkPoints);
    }

    if (allPoints.length === 0) {
      throw new Error(
        'No points found in any of the specified entities or links'
      );
    }

    return allPoints;
  }

  /**
   * Get all available link IDs with their metadata
   */
  getAllLinkInfo(): Array<{
    linkId: string;
    sourceEntity: string;
    targetEntity: string;
    label?: string;
  }> {
    const allLinks = this.svgElement.querySelectorAll('g.link');
    const linkInfo: Array<{
      linkId: string;
      sourceEntity: string;
      targetEntity: string;
      label?: string;
    }> = [];

    for (const link of allLinks) {
      const linkId = link.getAttribute('id') || '';
      const sourceEntity = link.getAttribute('data-entity-1') || '';
      const targetEntity = link.getAttribute('data-entity-2') || '';

      // Extract label from text elements
      let label: string | undefined;
      const textElements = link.querySelectorAll('text');
      if (textElements.length > 0) {
        label = Array.from(textElements)
          .map((text) => text.textContent || '')
          .join(' ')
          .trim();
        if (label === '') label = undefined;
      }

      linkInfo.push({
        linkId,
        sourceEntity,
        targetEntity,
        label,
      });
    }

    return linkInfo;
  }
}
