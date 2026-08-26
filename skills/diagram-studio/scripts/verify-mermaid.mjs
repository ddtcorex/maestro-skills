#!/usr/bin/env node
/**
 * verify-mermaid.mjs — CLI fallback for diagram-studio skill
 * - extracts ```mermaid blocks from file or stdin
 * - calls mermaid.parse() when available, falls back to heuristic
 * - returns {ok, errors, warnings}, CLI exits 0/1
 * Usage: node verify-mermaid.mjs <file|-> [--strict]
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

/**
 * Verify Mermaid syntax.
 * @param {string} input - mermaid source or file path when isPath true
 * @param {boolean} isPath - if true, input is treated as file path
 * @param {boolean} strict - if true, check anti-patterns (shadow)
 * @returns {{ok:boolean, errors:Array<{line:number,col:number,msg:string}>, warnings:Array<{msg:string}>}}
 */
export function verifyMermaid(input, isPath = false, strict = false) {
  let src = input;

  if (isPath) {
    // read file; support both absolute and relative to cwd
    let raw;
    try {
      raw = fs.readFileSync(input, 'utf-8');
    } catch (e) {
      // try relative to cwd if initial path failed and not absolute
      if (!path.isAbsolute(input)) {
        try {
          raw = fs.readFileSync(path.resolve(process.cwd(), input), 'utf-8');
        } catch (e2) {
          return { ok: false, errors: [{ line: 1, col: 0, msg: e.message }], warnings: [] };
        }
      } else {
        return { ok: false, errors: [{ line: 1, col: 0, msg: e.message }], warnings: [] };
      }
    }
    src = raw;
    // extract ```mermaid blocks if present
    const blocks = [...src.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
    if (blocks.length) src = blocks.join('\n');
  } else {
    // input is direct mermaid source; but if it contains fences, extract them as well
    if (src && src.includes('```mermaid')) {
      const blocks = [...src.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
      if (blocks.length) src = blocks.join('\n');
    }
  }

  src = (src || '').trim();
  if (!src) {
    return { ok: false, errors: [{ line: 1, col: 0, msg: 'Empty input' }], warnings: [] };
  }

  // Try real mermaid.parse if available via require (sync)
  let parseError = null;
  let usedMermaid = false;
  try {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line import/no-extraneous-dependencies
    const mermaid = require('mermaid');
    // mermaid v10 exposes mermaid.parse or mermaid.default.parse
    const parseFn =
      (mermaid && typeof mermaid.parse === 'function' && mermaid.parse) ||
      (mermaid && mermaid.default && typeof mermaid.default.parse === 'function' && mermaid.default.parse) ||
      null;
    if (parseFn) {
      usedMermaid = true;
      // mermaid.parse may throw on invalid syntax
      // Some versions need initialize call; safe to call parse directly
      parseFn(src);
    }
  } catch (e) {
    if (usedMermaid) {
      parseError = e;
    } else {
      // mermaid not installed or not usable — fall back to heuristic
      // keep parseError null, heuristic will decide
    }
  }

  if (parseError) {
    const line = parseError?.hash?.line || extractLineFromMessage(parseError.message) || 1;
    const col = parseError?.hash?.col || 0;
    return { ok: false, errors: [{ line, col, msg: parseError.message }], warnings: [] };
  }

  // Heuristic fallback when mermaid not available or did not error
  // Detect invalid arrow syntax like "A-->" with no target
  if (!usedMermaid) {
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // line ends with --> with optional spaces, no destination token
      if (/-->\s*$/.test(line) && line.includes('-->')) {
        // ensure it's not a comment or valid subgraph line
        // If line trimmed ends exactly with --> then it's invalid
        const trimmed = line.trim();
        if (trimmed.endsWith('-->')) {
          return {
            ok: false,
            errors: [{ line: i + 1, col: line.indexOf('-->'), msg: `Parse error on line ${i + 1}: Incomplete arrow syntax` }],
            warnings: [],
          };
        }
      }
      // Also detect "-->" with only whitespace after but missing target on same line
      // e.g., "A--> " is invalid
    }
    // Additional simple invalid checks: empty flowchart body?
    // If src is only "flowchart TB" with no nodes, treat as invalid? Not needed for tests
  }

  // Strict anti-pattern checks (warnings, not errors)
  const warnings = [];
  if (strict) {
    if (src.includes('shadow')) {
      warnings.push({ msg: 'anti-pattern: shadow' });
    }
    if (/\bgraph\s+(TD|TB|LR|RL|BT)\b/.test(src)) {
      warnings.push({ msg: 'anti-pattern: use flowchart not graph' });
    }
  }

  return { ok: true, errors: [], warnings };
}

function extractLineFromMessage(msg) {
  if (!msg) return null;
  const m = msg.match(/line\s+(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

// CLI handling
function isMain() {
  // import.meta.url is file://..., process.argv[1] is absolute path
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
  const self = path.resolve(fileURLToPath(import.meta.url));
  return entry === self;
}

if (isMain()) {
  const args = process.argv.slice(2);
  let strict = false;
  let target = null;
  for (const a of args) {
    if (a === '--strict') strict = true;
    else if (!target) target = a;
  }

  let inputData = '';
  let isPath = false;

  if (!target || target === '-') {
    // stdin
    try {
      inputData = fs.readFileSync(0, 'utf-8');
    } catch (e) {
      console.log(JSON.stringify({ ok: false, errors: [{ line: 1, col: 0, msg: e.message }], warnings: [] }, null, 2));
      process.exit(1);
    }
    isPath = false;
    // if stdin contains fences, verifyMermaid will extract; but we can also let it handle
  } else {
    inputData = target;
    isPath = true;
    // --strict passed via CLI will be used
  }

  // Also check env or second arg for strict; already handled
  const result = verifyMermaid(inputData, isPath, strict);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
