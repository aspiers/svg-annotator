# SVG Annotator Tutorial

This tutorial will walk you through the complete hull generation workflow, from basic usage to advanced techniques.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- An SVG file with properly marked entity groups

### Sample SVG File

Let's create a simple SVG file to work with. Save this as `sample-diagram.svg`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
  <!-- Treasury System -->
  <g data-entity="Treasury">
    <rect x="20" y="20" width="120" height="60" fill="#E3F2FD" stroke="#1976D2"/>
    <text x="80" y="55" text-anchor="middle" font-family="Arial" font-size="14">Treasury</text>
  </g>
  
  <!-- Funding Sources -->
  <g data-entity="FundingSource">
    <rect x="20" y="120" width="120" height="60" fill="#E8F5E8" stroke="#388E3C"/>
    <text x="80" y="155" text-anchor="middle" font-family="Arial" font-size="14">Funding Source</text>
  </g>
  
  <!-- Impact Measurement -->
  <g data-entity="ImpactMeasurer">
    <rect x="200" y="20" width="140" height="60" fill="#FFF3E0" stroke="#F57C00"/>
    <text x="270" y="55" text-anchor="middle" font-family="Arial" font-size="14">Impact Measurer</text>
  </g>
  
  <!-- External World -->
  <g data-entity="ExternalWorld">
    <rect x="200" y="120" width="140" height="60" fill="#FCE4EC" stroke="#C2185B"/>
    <text x="270" y="155" text-anchor="middle" font-family="Arial" font-size="14">External World</text>
  </g>
  
  <!-- Evaluator -->
  <g data-entity="Evaluator">
    <rect x="110" y="220" width="120" height="60" fill="#F3E5F5" stroke="#7B1FA2"/>
    <text x="170" y="255" text-anchor="middle" font-family="Arial" font-size="14">Evaluator</text>
  </g>
</svg>
```

## Tutorial Steps

### Step 1: Basic Hull Generation

Let's start with the simplest case - generating a hull around a single entity:

```bash
svg-annotator Treasury --svg sample-diagram.svg > treasury-hull.svg
```

This creates a concave hull around the Treasury entity with default settings:
- Catmull-Rom spline curve
- 15px padding
- Concavity of 20
- Watercolor effects enabled

### Step 2: Multiple Entities

Generate a hull that encompasses multiple related entities:

```bash
svg-annotator Treasury FundingSource --svg sample-diagram.svg --verbose > financial-system.svg
```

The `--verbose` flag shows detailed information about the processing:
- Number of points found
- Hull calculation results
- Area and perimeter measurements

### Step 3: Customizing Visual Appearance

Experiment with different curve types and parameters:

```bash
# Smooth cardinal curve with high tension
svg-annotator ImpactMeasurer --curve-type cardinal --curve-tension 0.8 --svg sample-diagram.svg > smooth-hull.svg

# Linear segments for geometric look
svg-annotator ExternalWorld --curve-type linear --svg sample-diagram.svg > geometric-hull.svg

# Highly organic B-spline curve
svg-annotator Evaluator --curve-type basis --svg sample-diagram.svg > organic-hull.svg
```

### Step 4: Adjusting Hull Shape

Control the tightness and size of hulls:

```bash
# Tight hull with minimal padding
svg-annotator Treasury --concavity 5 --padding 5 --svg sample-diagram.svg > tight-hull.svg

# Looser hull with more padding
svg-annotator Treasury --concavity 50 --padding 30 --svg sample-diagram.svg > loose-hull.svg
```

**Concavity Parameter:**
- Lower values (1-10): Very tight, follows entity contours closely
- Medium values (20-50): Balanced, natural-looking hulls
- Higher values (100+): Looser, more convex hulls

### Step 5: Using Focus Areas

Create a focus areas configuration file `tutorial-areas.yml`:

```yaml
- name: Financial
  color: "#4CAF50"
  areas:
    - Treasury
    - FundingSource

- name: Measurement
  color: "#FF9800"
  areas:
    - ImpactMeasurer
    - Evaluator

- name: External
  color: "#E91E63"
  url: https://example.com/external-docs
  areas:
    - ExternalWorld
```

Generate hulls for focus areas:

```bash
# Single focus area
svg-annotator --areas tutorial-areas.yml Financial --svg sample-diagram.svg > financial-focus.svg

# All focus areas
svg-annotator --areas tutorial-areas.yml --svg sample-diagram.svg > all-focus-areas.svg
```

### Step 6: Pattern Matching

Use wildcards to select multiple entities:

```bash
# All entities starting with "Impact"
svg-annotator "Impact*" --svg sample-diagram.svg > impact-entities.svg

# All entities containing "al" (External, Evaluator, etc.)
svg-annotator "*al*" --svg sample-diagram.svg > entities-with-al.svg
```

## Programmatic Usage Tutorial

### Basic Library Usage

```typescript
import { SVGAnnotator } from 'svg-annotator';

// Initialize with SVG file
const annotator = new SVGAnnotator('./sample-diagram.svg');

// Generate hull for Treasury
const treasuryHull = annotator.generateHullOverlay(['Treasury'], {
  curveType: 'catmull-rom',
  padding: 20,
  color: '#4CAF50',
  enableWatercolor: true
});

console.log('Treasury hull path:', treasuryHull.pathData);
console.log('Hull area:', treasuryHull.hull.area);
```

### Advanced Library Usage

```typescript
import { 
  SVGParser, 
  HullCalculator, 
  SplineGenerator,
  WatercolorFilters,
  GeometryUtils 
} from 'svg-annotator';

// Step-by-step hull generation
const parser = new SVGParser('./sample-diagram.svg');
const calculator = new HullCalculator();
const generator = new SplineGenerator();

// Extract points from entities
const points = parser.extractPointsFromEntityGroups(['Treasury', 'FundingSource']);
console.log(`Extracted ${points.length} points`);

// Calculate concave hull
const hull = calculator.calculateConcaveHull(points, 15);
console.log(`Hull has ${hull.points.length} vertices`);
console.log(`Area: ${hull.area.toFixed(2)}, Perimeter: ${hull.perimeter.toFixed(2)}`);

// Generate smooth spline
const splineConfig = { type: 'cardinal', tension: 0.3 };
const spline = generator.generateSpline(hull.points, splineConfig);
console.log('Spline path:', spline.pathData);

// Create watercolor filter
const filterId = WatercolorFilters.generateFilterId('financial');
const filterConfig = WatercolorFilters.createDefaultConfig(hull.area);
const filterSVG = WatercolorFilters.generateWatercolorFilter(filterId, filterConfig);

// Calculate centroid for labeling
const centroid = GeometryUtils.calculateCentroid(hull.points);
console.log(`Label position: (${centroid.x.toFixed(1)}, ${centroid.y.toFixed(1)})`);
```

### Building a Complete SVG Output

```typescript
import { SVGAnnotator } from 'svg-annotator';
import { writeFileSync } from 'fs';

const annotator = new SVGAnnotator('./sample-diagram.svg');

// Generate multiple focus area overlays
const overlays = annotator.generateFocusAreaOverlays('./tutorial-areas.yml');

// Build complete SVG
let svgOutput = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">`;

// Add filter definitions
const filterDefs = overlays
  .map(overlay => overlay.filterDef)
  .filter(def => def)
  .join('\n');

if (filterDefs) {
  svgOutput += `\n<defs>\n${filterDefs}\n</defs>`;
}

// Add hull paths
for (const overlay of overlays) {
  const { pathData, color, filterId, focusArea } = overlay;
  
  svgOutput += `\n<!-- Hull for ${focusArea.name} -->`;
  
  if (focusArea.url) {
    svgOutput += `\n<a href="${focusArea.url}">`;
  }
  
  svgOutput += `\n<path d="${pathData}" fill="${color}" fill-opacity="0.9" stroke="none"`;
  
  if (filterId) {
    svgOutput += ` filter="url(#${filterId})"`;
  }
  
  svgOutput += ` style="mix-blend-mode: multiply;"/>`;
  
  if (focusArea.url) {
    svgOutput += '\n</a>';
  }
  
  // Add label
  const { x, y } = overlay.labelPosition;
  svgOutput += `\n<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial" font-size="16" fill="#333" font-weight="bold">${focusArea.name}</text>`;
}

svgOutput += '\n</svg>';

// Save the result
writeFileSync('./annotated-diagram.svg', svgOutput);
console.log('Annotated diagram saved to annotated-diagram.svg');
```

## Tips and Best Practices

### 1. Choosing Curve Types

- **Catmull-Rom**: Best for most use cases, natural flowing curves
- **Cardinal**: Good when you need fine control over smoothness
- **Linear**: Use for technical diagrams where precision matters
- **Basis**: Perfect for organic, hand-drawn aesthetics
- **Basis-closed**: Ideal for enclosed areas with smooth boundaries

### 2. Optimizing Parameters

- **Start with defaults** and adjust incrementally
- **Lower concavity** (1-10) for tight, detailed hulls
- **Higher concavity** (50+) for broader, more inclusive hulls
- **Adjust padding** based on your SVG scale and desired visual spacing

### 3. Color Selection

```typescript
// Good color choices for overlays
const colors = {
  primary: '#2196F3',     // Blue - for main focus areas
  secondary: '#4CAF50',   // Green - for supporting elements
  accent: '#FF9800',      // Orange - for highlights
  subtle: '#E0E0E0',      // Gray - for background groupings
};
```

### 4. Performance Considerations

- **Large SVGs**: Consider processing in chunks or using simpler curve types
- **Many entities**: Use focus areas to group related elements
- **Complex shapes**: Higher concavity values process faster

### 5. Troubleshooting Common Issues

**Hull looks jagged:**
```bash
# Increase smoothness with cardinal curves
svg-annotator MyEntity --curve-type cardinal --curve-tension 0.1
```

**Hull is too tight:**
```bash
# Increase concavity and padding
svg-annotator MyEntity --concavity 30 --padding 25
```

**Hull is too loose:**
```bash
# Decrease concavity
svg-annotator MyEntity --concavity 5 --padding 10
```

**Text labels overlap:**
- The collision avoidance system automatically handles this
- For manual control, use the library API with custom positioning

## Next Steps

- Explore the [API Reference](../README.md#library-api) for detailed method documentation
- Check out the [Focus Areas Guide](../README.md#focus-areas-configuration) for advanced YAML configurations
- Browse the test files in `test/` for more code examples
- Contribute to the project by adding new curve types or visual effects

Happy annotating! 🎨