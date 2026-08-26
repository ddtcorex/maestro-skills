#!/usr/bin/env node
// TDD RED test for verify-mermaid CLI fallback
// Must fail with Cannot find module before implementation
import { verifyMermaid } from '../scripts/verify-mermaid.mjs';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let total = 5;

function ok(name, fn) {
  try { fn(); console.log(`✓ ${name}`); passed++; } catch (e) { console.error(`✗ ${name}: ${e.message}`); console.error(e.stack); }
}

ok('valid flowchart passes', () => {
  const r = verifyMermaid("flowchart TB\n  A-->B");
  assert.strictEqual(r.ok, true, `expected ok true got ${JSON.stringify(r)}`);
  assert.deepStrictEqual(r.errors, []);
});

ok('invalid syntax fails at line 2', () => {
  const r = verifyMermaid("flowchart TB\n  A-->");
  assert.strictEqual(r.ok, false, `expected ok false got ${JSON.stringify(r)}`);
  assert.ok(r.errors.length > 0, 'expected errors');
  assert.strictEqual(r.errors[0].line, 2, `expected line 2 got ${r.errors[0].line}`);
});

ok('reads from path when isPath', () => {
  const archPath = path.resolve(__dirname, '../../../../docs/architecture.md');
  // also support relative
  const target = fs.existsSync(archPath) ? archPath : 'docs/architecture.md';
  const r = verifyMermaid(target, true);
  assert.strictEqual(r.ok, true, `expected ok true from path, got ${JSON.stringify(r)}`);
});

ok('detects anti-pattern shadow when strict', () => {
  const r = verifyMermaid("flowchart TB\n  A-->B\n  style A shadow:true", false, true);
  assert.ok(r.warnings && r.warnings.length > 0, `expected warnings for shadow, got ${JSON.stringify(r)}`);
});

ok('empty input fails', () => {
  const r = verifyMermaid("");
  assert.strictEqual(r.ok, false, `expected ok false for empty, got ${JSON.stringify(r)}`);
});

console.log(`\n${passed}/${total} passed`);
if (passed !== total) process.exit(1);
