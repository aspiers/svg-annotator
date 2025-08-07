# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

SVG Annotator is a TypeScript library and CLI tool for generating visual hull overlays around entity groups in SVG diagrams. It creates smooth, organic boundaries (concave hulls) with watercolor effects and intelligent text positioning.

## Development Commands

### Building and Testing

```bash
npm run build          # Compile TypeScript to lib/
npm run dev            # Run with tsx in development
npm test               # Run all tests with Node.js test runner
npm run test:watch     # Watch mode for tests
npm run format         # Format code with Prettier
npm run format:check   # Check formatting without changes
```

### CLI Development

```bash
# Global installation for CLI testing
npm install -g .

# Test CLI locally (after building)
node lib/index.js --help
```

## Architecture

### Core Processing Pipeline

SVG Input → Entity Extraction → Point Collection → Hull Calculation → Padding Application → Spline Generation → Filter Application → Text Positioning → SVG Output

### Key Modules

- **`library.ts`** - Main `SVGAnnotator` class providing high-level API
- **`index.ts`** - CLI implementation (`SVGAnnotatorCLI`) using commander.js
- **`svgParser.ts`** - SVG parsing with JSDOM, extracts entity groups by `data-entity` attributes
- **`hullCalculator.ts`** - Concave hull calculation using concaveman algorithm
- **`splineGenerator.ts`** - Smooth curve generation with D3-shape (multiple curve types)
- **`watercolorFilters.ts`** - SVG filter generation for artistic watercolor effects
- **`textCollisionDetector.ts`** - Intelligent label positioning to avoid overlaps
- **`highlightAreaParser.ts`** - YAML configuration parsing for entity groupings

### Data Flow Architecture

1. Parse SVG with JSDOM to extract entity points
2. Calculate concave hull using concaveman algorithm
3. Apply padding to hull boundaries
4. Generate smooth splines with D3-shape
5. Create watercolor SVG filters
6. Position text labels avoiding collisions
7. Output final annotated SVG

### TypeScript Configuration

- **Source**: `src/` (ES modules with `.js` imports)
- **Output**: `lib/` with `.d.ts`, `.js`, `.map` files
- **Target**: ES2020 with strict type checking
- **Module**: ES modules throughout

### Testing Strategy

Uses Node.js built-in test runner with tests in `test/`:

- Unit tests for core algorithms (hull, splines, geometry, colors)
- CLI integration tests
- No external test framework dependencies

### SVG Requirements

**Entities** must be marked with `data-entity` attributes:

```xml
<g data-entity="EntityName">
  <!-- entity content -->
</g>
```

**Links** can be marked with `data-link` attributes:

```xml
<!-- Single element links -->
<line data-link="connection1" x1="10" y1="10" x2="50" y2="50"/>
<path data-link="flow1" d="M10,10 Q30,20 50,10"/>

<!-- Link groups -->
<g data-link="complex-link">
  <path d="M10,10 L50,50"/>
  <circle cx="50" cy="50" r="3"/>
</g>
```

### Highlight Areas Configuration

YAML-based entity grouping system supporting:

- Custom colors and labels
- Entity groups (via `data-entity` attributes)
- Link connections (via `data-link` attributes)
- Pattern matching (e.g., `Impact*`)
- Clickable URLs
- Reusable configurations

### Key Design Patterns

- **Facade Pattern**: `SVGAnnotator` wraps complex operations
- **Strategy Pattern**: Multiple curve types and algorithms
- **Factory Pattern**: Configuration creation with defaults

## Common Issues

### Type Definition Inconsistency

The codebase has a type mismatch where code imports `ConcaveHullResult` but the types file defines `ConcaveBoundaryResult`. When working with hull calculations, verify which interface is actually being used.

### ES Module Imports

All TypeScript files use `.js` extensions in imports (ES module requirement). When adding new files, ensure imports use `.js` extensions even for TypeScript files.

### SVG Processing

Uses JSDOM for server-side SVG manipulation. Complex SVG structures with nested groups are supported, but entities must have proper `data-entity` attributes for detection.
