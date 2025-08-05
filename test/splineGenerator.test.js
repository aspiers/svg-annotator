import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SplineGenerator } from '../lib/splineGenerator.js';

describe('SplineGenerator', () => {
  test('should generate spline for valid points', () => {
    const generator = new SplineGenerator();
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];
    const config = { type: 'catmull-rom' };

    const result = generator.generateSpline(points, config);
    
    assert.ok(result.pathData, 'Should return path data');
    assert.equal(result.curveType, 'catmull-rom', 'Should match curve type');
    assert.deepEqual(result.originalPoints, points, 'Should preserve original points');
  });

  test('should throw error for insufficient points', () => {
    const generator = new SplineGenerator();
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 }
    ];
    const config = { type: 'linear' };

    assert.throws(
      () => generator.generateSpline(points, config),
      /At least 3 points are required/
    );
  });

  test('should create valid spline config', () => {
    const config = SplineGenerator.createConfig('cardinal', 0.8, 0.3);
    
    assert.equal(config.type, 'cardinal');
    assert.equal(config.tension, 0.8);
    assert.equal(config.alpha, 0.3);
  });

  test('should validate spline config', () => {
    const validConfig = { type: 'catmull-rom' };
    assert.doesNotThrow(() => SplineGenerator.validateConfig(validConfig));

    const invalidConfig = { type: 'invalid-type' };
    assert.throws(
      () => SplineGenerator.validateConfig(invalidConfig),
      /Invalid curve type/
    );
  });

  test('should get curve types', () => {
    const curveTypes = SplineGenerator.getCurveTypes();
    assert.ok(curveTypes['catmull-rom'], 'Should include catmull-rom');
    assert.ok(curveTypes['linear'], 'Should include linear');
    assert.ok(curveTypes['cardinal'], 'Should include cardinal');
  });
});