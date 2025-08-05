# SVG Annotator

A mostly vibe-coded TypeScript library and CLI tool for generating
visual hull overlays around entity groups in SVG diagrams. Perfect for
creating focus area annotations, highlighting related elements, and
adding visual emphasis to complex diagrams.

## Features

- **Concave Hull Generation**: Create smooth, organic boundaries around grouped elements
- **Multiple Curve Types**: Linear, Catmull-Rom, Cardinal, B-spline, and closed curves
- **Watercolor Effects**: Artistic SVG filters for beautiful visual overlays
- **Text Collision Avoidance**: Intelligent label positioning to avoid overlapping existing elements
- **Focus Area Support**: YAML-based configuration for reusable entity groupings
- **Pattern Matching**: Wildcard support for selecting multiple entities (e.g., `Impact*`)
- **TypeScript Support**: Full type definitions for library usage
- **Both CLI and Library**: Use as a command-line tool or integrate programmatically

## Installation

### Global Installation (CLI)

```bash
npm install -g svg-annotator
```

Or install directly from source:

```bash
git clone <repository-url>
cd svg-annotator
npm install -g .
```

### Local Installation (Library)

```bash
npm install svg-annotator
```

## Quick Start

### CLI Usage

```bash
# Basic usage - annotate a single entity
svg-annotator MyEntity --svg diagram.svg

# Multiple entities with custom styling
svg-annotator Entity1 Entity2 --curve-type cardinal --padding 20

# Use focus areas configuration
svg-annotator --areas focus-areas.yml

# Pattern matching
svg-annotator "Impact*" --verbose
```

### Library Usage

```typescript
import { SVGAnnotator } from 'svg-annotator';

// Initialize with SVG file
const annotator = new SVGAnnotator('./diagram.svg');

// Generate hull overlay for entities
const result = annotator.generateHullOverlay(['Entity1', 'Entity2'], {
  curveType: 'catmull-rom',
  padding: 15,
  color: '#FF6B6B',
  enableWatercolor: true,
});

console.log(result.pathData); // SVG path for the hull
```

## CLI Reference

### Basic Syntax

```
svg-annotator [entity-names...] [options]
```

### Options

| Option                            | Description                                                    | Default       |
| --------------------------------- | -------------------------------------------------------------- | ------------- |
| `-s, --svg <file>`                | SVG file path                                                  | `ERD.svg`     |
| `-c, --concavity <number>`        | Concavity parameter (lower = more concave)                     | `20`          |
| `-l, --length-threshold <number>` | Length threshold for edge filtering                            | `0`           |
| `--curve-type <type>`             | Curve type: linear, catmull-rom, cardinal, basis, basis-closed | `catmull-rom` |
| `--curve-tension <number>`        | Tension for cardinal curves (0.0-1.0)                          | `0.2`         |
| `--curve-alpha <number>`          | Alpha for Catmull-Rom curves (0.0-1.0)                         | `0.5`         |
| `-p, --padding <number>`          | Padding around hull in SVG units                               | `15`          |
| `--areas <file>`                  | YAML file containing focus area definitions                    | -             |
| `-v, --verbose`                   | Verbose output                                                 | `false`       |
| `-h, --help`                      | Display help information                                       | -             |
| `-V, --version`                   | Display version number                                         | -             |

### Examples

```bash
# Single entity with custom curve
svg-annotator Treasury --curve-type cardinal --curve-tension 0.8

# Multiple entities with padding
svg-annotator Treasury FundingSource --padding 25

# Output to file
svg-annotator ObjectivesDesigner > annotated-diagram.svg

# Pattern matching for multiple entities
svg-annotator "Impact*" --concavity 15

# Use focus areas configuration
svg-annotator --areas focus-areas.yml Carlos

# All focus areas
svg-annotator --areas focus-areas.yml
```

## Focus Areas Configuration

Focus areas allow you to define reusable entity groupings with custom colors and labels. Create a YAML file:

```yaml
# focus-areas.yml
- name: Carlos
  color: pink
  areas:
    - Measurer
    - Measurement
    - Evaluator

- name: Luca
  color: lemonchiffon
  url: https://example.com
  areas:
    - ExternalWorld
    - RewardAllocation

- name: Impact Tracking
  color: '#E3F2FD'
  areas:
    - ImpactContributor
    - ImpactEvidence
    - ImpactMeasurement
```

### Focus Area Properties

- `name`: Identifier used as CLI argument
- `color`: Hull fill color (hex, named color, or RGB)
- `areas`: Array of entity names to include
- `url` (optional): Makes the hull clickable

## Library API

### SVGAnnotator Class

The main class for programmatic usage:

```typescript
import { SVGAnnotator } from 'svg-annotator';

const annotator = new SVGAnnotator('path/to/diagram.svg');
```

#### Methods

##### `generateHullOverlay(entityNames, options)`

Generate a hull overlay for specified entities.

**Parameters:**

- `entityNames: string[]` - Array of entity names
- `options: object` - Configuration options
  - `concavity?: number` - Concavity parameter (default: 2)
  - `curveType?: CurveType` - Curve type (default: 'catmull-rom')
  - `padding?: number` - Padding in SVG units (default: 10)
  - `color?: string` - Hull color (default: '#FF0000')
  - `enableWatercolor?: boolean` - Enable watercolor effects (default: true)

**Returns:** Object with hull data, SVG path, and filter information.

##### `generateFocusAreaOverlays(focusAreasFilePath)`

Generate overlays for all focus areas from a YAML file.

**Parameters:**

- `focusAreasFilePath: string` - Path to YAML configuration file

**Returns:** Array of overlay results with label positioning.

### Individual Classes

Access individual components for fine-grained control:

```typescript
import {
  SVGParser,
  HullCalculator,
  SplineGenerator,
  WatercolorFilters,
  TextCollisionDetector,
} from 'svg-annotator';

// Parse SVG and extract entity points
const parser = new SVGParser('./diagram.svg');
const points = parser.extractPointsFromEntityGroups(['MyEntity']);

// Calculate concave hull
const calculator = new HullCalculator();
const hull = calculator.calculateConcaveHull(points, 2);

// Generate smooth spline
const generator = new SplineGenerator();
const spline = generator.generateSpline(hull.points, { type: 'catmull-rom' });
```

## SVG Requirements

Your SVG diagrams should have entity groups marked with `data-entity` attributes:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <g data-entity="Treasury">
    <rect x="10" y="10" width="100" height="50"/>
    <text x="60" y="35">Treasury</text>
  </g>

  <g data-entity="FundingSource">
    <rect x="150" y="10" width="120" height="50"/>
    <text x="210" y="35">Funding Source</text>
  </g>
</svg>
```

## Curve Types

| Type           | Description                       | Best For                    |
| -------------- | --------------------------------- | --------------------------- |
| `linear`       | Straight line segments            | Simple, geometric shapes    |
| `catmull-rom`  | Smooth curve through all points   | Natural, flowing boundaries |
| `cardinal`     | Smooth curve with tension control | Customizable smoothness     |
| `basis`        | B-spline (very smooth)            | Highly organic shapes       |
| `basis-closed` | Closed B-spline curve             | Enclosed areas              |

## Development

### Building from Source

```bash
git clone https://github.com/your-repo/svg-annotator.git
cd svg-annotator
npm install
npm run build
```

### Running Tests

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
```

### Development Mode

```bash
npm run dev             # Run with tsx
```

## License

GPL-3.0 License - see [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Changelog

### v1.0.0

- Initial release
- Concave hull generation
- Multiple curve types
- Watercolor effects
- Text collision avoidance
- Focus areas support
- Full TypeScript support
