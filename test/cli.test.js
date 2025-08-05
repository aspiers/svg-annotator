import { test, describe } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CLI Integration Tests', () => {
  // Simple test SVG with entity groups
  const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <g data-entity="TestEntity">
    <rect x="10" y="10" width="50" height="30" fill="blue"/>
    <text x="35" y="25">Test</text>
  </g>
  <g data-entity="AnotherEntity">
    <rect x="100" y="100" width="40" height="40" fill="red"/>
    <text x="120" y="120">Another</text>
  </g>
</svg>`;

  const testSvgPath = resolve('./test-svg.svg');

  // Helper function to run CLI command
  function runCLI(args, input = null) {
    return new Promise((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'src/index.ts', ...args], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      if (input) {
        child.stdin.write(input);
        child.stdin.end();
      }

      child.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      child.on('error', reject);
    });
  }

  test('should show help when --help flag is used', async () => {
    const result = await runCLI(['--help']);
    
    assert.equal(result.code, 0, 'Help command should exit with code 0');
    assert.ok(result.stdout.includes('svg-annotator'), 'Help should contain command name');
    assert.ok(result.stdout.includes('Generate visual hull overlays'), 'Help should contain description');
  });

  test('should show version when --version flag is used', async () => {
    const result = await runCLI(['--version']);
    
    assert.equal(result.code, 0, 'Version command should exit with code 0');
    assert.ok(result.stdout.trim().match(/^\d+\.\d+\.\d+$/), 'Should output valid version number');
  });

  test('should handle missing SVG file gracefully', async () => {
    const result = await runCLI(['TestEntity', '--svg', 'nonexistent.svg']);
    
    assert.equal(result.code, 1, 'Should exit with error code');
    assert.ok(result.stderr.includes('SVG file not found'), 'Should report missing file');
  });

  test('should process valid entity with test SVG', async () => {
    // Create test SVG file
    writeFileSync(testSvgPath, testSvg);

    try {
      const result = await runCLI(['TestEntity', '--svg', testSvgPath, '--verbose']);
      
      assert.equal(result.code, 0, 'Should exit successfully');
      assert.ok(result.stdout.includes('<path'), 'Should output SVG path');
      assert.ok(result.stderr.includes('Loading SVG file'), 'Should show verbose output');
    } finally {
      // Clean up test file
      if (existsSync(testSvgPath)) {
        unlinkSync(testSvgPath);
      }
    }
  });

  test('should handle invalid curve type', async () => {
    writeFileSync(testSvgPath, testSvg);

    try {
      const result = await runCLI(['TestEntity', '--svg', testSvgPath, '--curve-type', 'invalid']);
      
      assert.equal(result.code, 1, 'Should exit with error code');
      assert.ok(result.stderr.includes('Invalid curve type'), 'Should report invalid curve type');
    } finally {
      if (existsSync(testSvgPath)) {
        unlinkSync(testSvgPath);
      }
    }
  });

  test('should handle missing entity gracefully', async () => {
    writeFileSync(testSvgPath, testSvg);

    try {
      const result = await runCLI(['NonExistentEntity', '--svg', testSvgPath]);
      
      assert.equal(result.code, 1, 'Should exit with error code');
      assert.ok(result.stderr.includes('not found'), 'Should report entity not found');
    } finally {
      if (existsSync(testSvgPath)) {
        unlinkSync(testSvgPath);
      }
    }
  });
});