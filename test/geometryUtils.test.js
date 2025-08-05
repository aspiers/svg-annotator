import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GeometryUtils } from '../lib/geometryUtils.js';

describe('GeometryUtils', () => {
  test('should calculate centroid of points', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    const centroid = GeometryUtils.calculateCentroid(points);

    assert.equal(centroid.x, 5, 'Centroid X should be 5');
    assert.equal(centroid.y, 5, 'Centroid Y should be 5');
  });

  test('should handle empty points array', () => {
    const points = [];
    const centroid = GeometryUtils.calculateCentroid(points);

    assert.equal(centroid.x, 0, 'Empty array should return origin');
    assert.equal(centroid.y, 0, 'Empty array should return origin');
  });

  test('should calculate text bounding box', () => {
    const bbox = GeometryUtils.calculateBoundingBox('Test', 16, 'Arial');

    assert.ok(bbox.width > 0, 'Text width should be positive');
    assert.ok(bbox.height > 0, 'Text height should be positive');
  });

  test('should detect rectangle overlap', () => {
    const rect1 = { x: 0, y: 0, width: 10, height: 10 };
    const rect2 = { x: 5, y: 5, width: 10, height: 10 };
    const rect3 = { x: 20, y: 20, width: 10, height: 10 };

    assert.ok(
      GeometryUtils.rectanglesOverlap(rect1, rect2),
      'Overlapping rectangles should return true'
    );
    assert.ok(
      !GeometryUtils.rectanglesOverlap(rect1, rect3),
      'Non-overlapping rectangles should return false'
    );
  });

  test('should find non-colliding position', () => {
    const preferredPosition = { x: 10, y: 10 };
    const existingBoxes = [
      { x: 8, y: 8, width: 4, height: 4 }, // overlaps with preferred position
    ];

    const position = GeometryUtils.findNearestNonCollidingPosition(
      'Test',
      16,
      'Arial',
      preferredPosition,
      existingBoxes
    );

    assert.ok(position, 'Should return a position');
    assert.ok(typeof position.x === 'number', 'Position should have numeric X');
    assert.ok(typeof position.y === 'number', 'Position should have numeric Y');
  });
});
