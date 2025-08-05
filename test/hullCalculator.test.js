import { test, describe } from 'node:test';
import assert from 'node:assert';
import { HullCalculator } from '../lib/hullCalculator.js';

describe('HullCalculator', () => {
  test('should calculate concave hull for simple square points', () => {
    const calculator = new HullCalculator();
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];

    const result = calculator.calculateConcaveHull(points);
    
    assert.ok(result.points.length >= 3, 'Hull should have at least 3 points');
    assert.ok(result.area > 0, 'Hull area should be positive');
    assert.ok(result.perimeter > 0, 'Hull perimeter should be positive');
  });

  test('should throw error for insufficient points', () => {
    const calculator = new HullCalculator();
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ];

    assert.throws(
      () => calculator.calculateConcaveHull(points),
      /At least 3 points are required/
    );
  });

  test('should handle duplicate points', () => {
    const calculator = new HullCalculator();
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 0 }, // duplicate
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];

    const result = calculator.calculateConcaveHull(points);
    assert.ok(result.points.length >= 3, 'Hull should handle duplicates');
  });

  test('should calculate convex hull', () => {
    const calculator = new HullCalculator();
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 } // interior point
    ];

    const convexHull = calculator.calculateConvexHull(points);
    assert.ok(convexHull.length >= 3, 'Convex hull should have at least 3 points');
  });
});