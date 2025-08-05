# Troubleshooting Guide

This guide covers common issues and their solutions when using SVG Annotator.

## Installation Issues

### `npm install -g svg-annotator` fails

**Problem:** Permission denied or access errors during global installation.

**Solutions:**

1. **Use npx instead** (recommended):
   ```bash
   npx svg-annotator MyEntity --svg diagram.svg
   ```

2. **Fix npm permissions**:
   ```bash
   npm config set prefix ~/.npm-global
   export PATH=~/.npm-global/bin:$PATH
   npm install -g svg-annotator
   ```

3. **Use sudo** (not recommended):
   ```bash
   sudo npm install -g svg-annotator
   ```

### TypeScript compilation errors

**Problem:** `error TS2307: Cannot find module 'svg-annotator'`

**Solution:** Ensure you have the correct imports:
```typescript
// Correct imports
import { SVGAnnotator } from 'svg-annotator';
import { HullCalculator } from 'svg-annotator';

// NOT this:
import SVGAnnotator from 'svg-annotator'; // Wrong!
```

## CLI Usage Issues

### "SVG file not found" error

**Problem:** CLI can't locate your SVG file.

**Solutions:**

1. **Use absolute paths**:
   ```bash
   svg-annotator MyEntity --svg /full/path/to/diagram.svg
   ```

2. **Check current directory**:
   ```bash
   ls -la *.svg  # List all SVG files
   svg-annotator MyEntity --svg ./diagram.svg
   ```

3. **Verify file permissions**:
   ```bash
   chmod 644 diagram.svg
   ```

### "Entity group not found" error

**Problem:** The specified entity doesn't exist in the SVG.

**Diagnosis:**
```bash
# Check what entities are available
grep -o 'data-entity="[^"]*"' diagram.svg
```

**Solutions:**

1. **Check entity names are exact matches** (case-sensitive):
   ```xml
   <!-- In SVG -->
   <g data-entity="Treasury">
   
   <!-- CLI command -->
   svg-annotator Treasury  # Correct
   svg-annotator treasury  # Wrong - case mismatch
   ```

2. **Use pattern matching to explore**:
   ```bash
   svg-annotator "*" --verbose  # Shows all available entities
   ```

3. **Verify SVG structure**:
   ```xml
   <!-- Correct structure -->
   <g data-entity="MyEntity">
     <rect x="10" y="10" width="50" height="30"/>
   </g>
   
   <!-- Incorrect - missing data-entity -->
   <g id="MyEntity">
     <rect x="10" y="10" width="50" height="30"/>
   </g>
   ```

### "At least 3 points are required" error

**Problem:** The entity group has insufficient geometric data.

**Causes:**
- Entity group contains only text elements
- All elements have zero dimensions
- Elements are positioned at the same coordinates

**Solutions:**

1. **Add geometric elements**:
   ```xml
   <g data-entity="MyEntity">
     <!-- Add rectangles, circles, or paths -->
     <rect x="10" y="10" width="100" height="50"/>
     <text x="60" y="35">My Entity</text>
   </g>
   ```

2. **Check element dimensions**:
   ```xml
   <!-- Problematic - zero dimensions -->
   <rect x="10" y="10" width="0" height="0"/>
   
   <!-- Fixed -->
   <rect x="10" y="10" width="100" height="50"/>
   ```

### Invalid curve type error

**Problem:** Specified curve type is not supported.

**Valid curve types:**
- `linear`
- `catmull-rom`
- `cardinal`
- `basis`
- `basis-closed`

**Solution:**
```bash
# Correct
svg-annotator MyEntity --curve-type catmell-rom

# Check available types
svg-annotator --help  # Lists all curve types
```

## Visual Output Issues

### Hull looks jagged or angular

**Problem:** The generated hull has sharp angles instead of smooth curves.

**Solutions:**

1. **Use smoother curve types**:
   ```bash
   # Try different curve types
   svg-annotator MyEntity --curve-type cardinal --curve-tension 0.1
   svg-annotator MyEntity --curve-type basis
   ```

2. **Adjust concavity**:
   ```bash
   # Higher concavity = smoother curves
   svg-annotator MyEntity --concavity 50
   ```

3. **Add more padding**:
   ```bash
   # More padding can improve smoothness
   svg-annotator MyEntity --padding 25
   ```

### Hull is too tight around entities

**Problem:** The hull follows entity boundaries too closely.

**Solutions:**

1. **Increase padding**:
   ```bash
   svg-annotator MyEntity --padding 30
   ```

2. **Increase concavity**:
   ```bash
   svg-annotator MyEntity --concavity 40
   ```

3. **Use a smoother curve type**:
   ```bash
   svg-annotator MyEntity --curve-type basis
   ```

### Hull is too loose or doesn't follow shape

**Problem:** The hull creates a large bubble that doesn't follow the entity shape.

**Solutions:**

1. **Decrease concavity**:
   ```bash
   svg-annotator MyEntity --concavity 5
   ```

2. **Reduce padding**:
   ```bash
   svg-annotator MyEntity --padding 5
   ```

3. **Use a tighter curve type**:
   ```bash
   svg-annotator MyEntity --curve-type catmull-rom
   ```

### Watercolor effects not visible

**Problem:** The watercolor filters don't appear in the output.

**Causes:**
- SVG viewer doesn't support filters
- Filters are disabled
- Color opacity is too low

**Solutions:**

1. **Test in different viewers**:
   - Chrome/Firefox browsers (best support)
   - Inkscape
   - Adobe Illustrator

2. **Check if filters are enabled** (they are by default in CLI)

3. **Increase opacity**:
   ```bash
   # Manually edit the SVG output
   fill-opacity="0.9"  # Instead of lower values
   ```

### Text labels overlap or are misplaced

**Problem:** Focus area labels appear in wrong positions or overlap with diagram elements.

**Solutions:**

1. **The collision avoidance system handles this automatically**, but if issues persist:

2. **Use library API for manual control**:
   ```typescript
   import { TextCollisionDetector, GeometryUtils } from 'svg-annotator';
   
   const detector = new TextCollisionDetector(parser);
   const position = detector.findNearestNonCollidingPosition(
     'My Label',
     16, // font size
     'Arial',
     preferredPosition
   );
   ```

3. **Simplify the SVG** by reducing text elements in the original diagram

## Focus Areas Issues

### YAML parsing errors

**Problem:** `Failed to parse focus areas file` error.

**Common YAML mistakes:**

```yaml
# Wrong - inconsistent indentation
- name: Area1
color: red      # Should be indented
  areas:
    - Entity1

# Wrong - missing quotes for special characters  
- name: Area with: colon
  color: red

# Correct format
- name: Area1
  color: red
  areas:
    - Entity1

- name: "Area with: colon"
  color: red
  areas:
    - Entity2
```

**Solutions:**

1. **Validate YAML syntax**:
   ```bash
   # Use online YAML validators or
   npx js-yaml focus-areas.yml
   ```

2. **Check indentation** (use spaces, not tabs)

3. **Quote special characters**:
   ```yaml
   - name: "Area: Special Characters"
     color: "#FF0000"  # Quote hex colors
   ```

### Invalid color values

**Problem:** `Invalid color` error in focus areas.

**Valid color formats:**
```yaml
- name: Area1
  color: red           # Named color
  
- name: Area2  
  color: "#FF0000"     # Hex color
  
- name: Area3
  color: "rgb(255,0,0)" # RGB color
```

**Invalid formats:**
```yaml
color: FF0000          # Missing #
color: red-ish         # Invalid name
color: hsl(0,100%,50%) # HSL not supported
```

### Focus area entities not found

**Problem:** Entities listed in focus areas don't exist in the SVG.

**Solutions:**

1. **Check entity names in both files**:
   ```bash
   # List entities in SVG
   grep -o 'data-entity="[^"]*"' diagram.svg
   
   # Check YAML content
   cat focus-areas.yml
   ```

2. **Use pattern matching**:
   ```yaml
   - name: AllImpact
     color: blue
     areas:
       - "Impact*"  # Matches ImpactMeasurer, ImpactEvidence, etc.
   ```

## Performance Issues

### Slow processing with large SVGs

**Problem:** CLI takes a long time to process large or complex SVGs.

**Solutions:**

1. **Use simpler curve types**:
   ```bash
   svg-annotator MyEntity --curve-type linear  # Fastest
   ```

2. **Reduce concavity** (higher values are slower):
   ```bash
   svg-annotator MyEntity --concavity 100  # Faster but less detailed
   ```

3. **Process fewer entities at once**:
   ```bash
   # Instead of all at once
   svg-annotator Entity1 Entity2 Entity3 Entity4
   
   # Process in groups
   svg-annotator Entity1 Entity2 > output1.svg
   svg-annotator Entity3 Entity4 > output2.svg
   ```

4. **Simplify the source SVG** by removing unnecessary elements

### Memory issues with Node.js

**Problem:** `JavaScript heap out of memory` error.

**Solutions:**

1. **Increase Node.js memory limit**:
   ```bash
   node --max-old-space-size=4096 $(which svg-annotator) MyEntity
   ```

2. **Use the library API** for more control over memory usage:
   ```typescript
   // Process entities one at a time
   for (const entity of entities) {
     const result = annotator.generateHullOverlay([entity]);
     // Process immediately, don't accumulate
   }
   ```

## Library Integration Issues

### Import errors in TypeScript projects

**Problem:** Cannot import svg-annotator classes.

**Solutions:**

1. **Check tsconfig.json**:
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "node",
       "esModuleInterop": true,
       "allowSyntheticDefaultImports": true
     }
   }
   ```

2. **Use correct import syntax**:
   ```typescript
   // ES modules (recommended)
   import { SVGAnnotator, HullCalculator } from 'svg-annotator';
   
   // CommonJS (if needed)
   const { SVGAnnotator } = require('svg-annotator');
   ```

3. **Ensure package is installed**:
   ```bash
   npm list svg-annotator
   npm install svg-annotator
   ```

### Runtime errors with file paths

**Problem:** `ENOENT: no such file or directory` when using library.

**Solutions:**

1. **Use absolute paths**:
   ```typescript
   import { resolve } from 'path';
   
   const svgPath = resolve(__dirname, 'diagram.svg');
   const annotator = new SVGAnnotator(svgPath);
   ```

2. **Check working directory**:
   ```typescript
   console.log('Current directory:', process.cwd());
   console.log('SVG path:', svgPath);
   ```

3. **Verify file exists**:
   ```typescript
   import { existsSync } from 'fs';
   
   if (!existsSync(svgPath)) {
     throw new Error(`SVG file not found: ${svgPath}`);
   }
   ```

## Getting Help

If you encounter issues not covered here:

1. **Check the [examples in tests](../test/)** for working code
2. **Review the [tutorial](./TUTORIAL.md)** for step-by-step guidance
3. **Enable verbose mode** for more diagnostic information:
   ```bash
   svg-annotator MyEntity --verbose
   ```
4. **Open an issue** on GitHub with:
   - Your command or code
   - Error message
   - Sample SVG file (if possible)
   - Node.js and npm versions

## Debug Mode

For detailed troubleshooting, you can modify the source code to add debug output:

```typescript
// In your project
import { SVGParser } from 'svg-annotator';

const parser = new SVGParser('./diagram.svg');

// Add debug logging
console.log('Available entities:');
const svgContent = require('fs').readFileSync('./diagram.svg', 'utf-8');
const matches = svgContent.match(/data-entity="([^"]*)"/g);
console.log(matches);

// Test entity existence
try {
  const points = parser.extractPointsFromEntityGroups(['YourEntity']);
  console.log(`Found ${points.length} points for YourEntity`);
} catch (error) {
  console.error('Entity not found:', error.message);
}
```

This helps identify exactly what entities are available and where the process fails.