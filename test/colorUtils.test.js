import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ColorUtils } from '../lib/colorUtils.js';

describe('ColorUtils', () => {
  test('should convert named colors to hex', () => {
    assert.equal(ColorUtils.toHex('red'), '#FF0000');
    assert.equal(ColorUtils.toHex('blue'), '#0000FF');
    assert.equal(ColorUtils.toHex('green'), '#008000');
    assert.equal(ColorUtils.toHex('pink'), '#FFC0CB');
  });

  test('should handle hex colors', () => {
    assert.equal(ColorUtils.toHex('#FF0000'), '#ff0000');
    assert.equal(ColorUtils.toHex('FF0000'), '#ff0000');
    assert.equal(ColorUtils.toHex('#f00'), '#ff0000');
    assert.equal(ColorUtils.toHex('f00'), '#ff0000');
  });

  test('should handle RGB colors', () => {
    assert.equal(ColorUtils.toHex('rgb(255, 0, 0)'), '#ff0000');
    assert.equal(ColorUtils.toHex('rgb(0, 255, 0)'), '#00ff00');
    assert.equal(ColorUtils.toHex('rgb(0, 0, 255)'), '#0000ff');
  });

  test('should validate colors', () => {
    assert.ok(ColorUtils.isValidColor('red'), 'Named color should be valid');
    assert.ok(ColorUtils.isValidColor('#FF0000'), 'Hex color should be valid');
    assert.ok(ColorUtils.isValidColor('#f00'), '3-digit hex should be valid');
    assert.ok(
      ColorUtils.isValidColor('rgb(255, 0, 0)'),
      'RGB color should be valid'
    );
    assert.ok(
      !ColorUtils.isValidColor('invalid'),
      'Invalid color should return false'
    );
  });

  test('should get supported color names', () => {
    const colors = ColorUtils.getSupportedColorNames();
    assert.ok(Array.isArray(colors), 'Should return an array');
    assert.ok(colors.includes('red'), 'Should include red');
    assert.ok(colors.includes('blue'), 'Should include blue');
    assert.ok(colors.length > 100, 'Should have many color names');
  });
});
