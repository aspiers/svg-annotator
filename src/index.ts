#!/usr/bin/env tsx

import { SVGAnnotatorCLI } from './cli.js';

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new SVGAnnotatorCLI();
  cli.run();
}

export { SVGAnnotatorCLI };
