#!/usr/bin/env node
/**
 * verify-mermaid.mjs: CLI fallback for the diagram-studio skill
 * - extracts ```mermaid blocks from a file or stdin and checks each block on its own
 * - uses the real mermaid parser when `mermaid` (and `jsdom`) can be imported
 * - otherwise falls back to a heuristic and SAYS SO: `validator: "heuristic"` plus a warning
 * - returns {ok, errors, warnings, validator}; the CLI exits 0 ok, 1 failed, 2 parser required but missing
 * Usage: node verify-mermaid.mjs <file|-> [--strict] [--require-parser]
 * Env:   VERIFY_MERMAID_NO_PARSER=1 forces the heuristic (CI, tests)
 *
 * A heuristic "ok" is NOT a syntax guarantee: it only catches incomplete arrows, unterminated
 * strings and unclosed brackets in flowcharts. Install `mermaid` and `jsdom` where Node can
 * resolve them from this script (for example `npm i --no-save mermaid jsdom` in the repo
 * checkout) to get a real parse, or pass --require-parser to refuse the heuristic.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HEURISTIC_NOTICE =
  'mermaid parser not available: syntax was only checked heuristically (install mermaid and jsdom to validate for real, or use --require-parser to refuse this mode)';

/** Resolve the source text into one or more diagram blocks, or return an error result. */
function prepare(input, isPath) {
  let src = input;
  if (isPath) {
    try {
      src = fs.readFileSync(input, 'utf-8');
    } catch (e) {
      // try relative to cwd if initial path failed and not absolute
      if (path.isAbsolute(input)) return { error: failure(e.message) };
      try {
        src = fs.readFileSync(path.resolve(process.cwd(), input), 'utf-8');
      } catch {
        return { error: failure(e.message) };
      }
    }
  }
  let blocks = [];
  if (src && src.includes('```mermaid')) {
    blocks = [...src.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1].trim()).filter(Boolean);
  } else if (src && src.trim()) {
    blocks = [src.trim()];
  }
  if (!blocks.length) return { error: failure('Empty input') };
  return { blocks };
}

function failure(msg) {
  return { ok: false, errors: [{ line: 1, col: 0, msg }], warnings: [], validator: 'heuristic' };
}

/** Remove "quoted strings" so brackets inside labels are not counted. */
function stripQuoted(line) {
  return line.replace(/"[^"]*"/g, '""');
}

/** Heuristic checks for one block. Returns the first error found, or null. */
function heuristicBlock(block) {
  const lines = block.split('\n');
  const first = (lines.find((l) => l.trim() && !l.trim().startsWith('%%')) || '').trim();
  const isFlowchart = /^(flowchart|graph)\b/.test(first);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('%%')) continue;
    // line ends with --> and no destination token
    if (trimmed.endsWith('-->')) {
      return { line: i + 1, col: line.indexOf('-->'), msg: `Parse error on line ${i + 1}: Incomplete arrow syntax` };
    }
    if (!isFlowchart) continue;
    if ((line.match(/"/g) || []).length % 2 === 1) {
      return { line: i + 1, col: line.indexOf('"'), msg: `Parse error on line ${i + 1}: Unterminated string` };
    }
    const bare = stripQuoted(line);
    // Only flag unclosed openers: asymmetric shapes such as A>text] legitimately have a lone closer.
    for (const [open, close] of [['[', ']'], ['(', ')'], ['{', '}']]) {
      const opens = bare.split(open).length - 1;
      const closes = bare.split(close).length - 1;
      if (opens > closes) {
        return { line: i + 1, col: bare.indexOf(open), msg: `Parse error on line ${i + 1}: Unclosed '${open}'` };
      }
    }
  }
  return null;
}

function strictWarnings(blocks, strict) {
  const warnings = [];
  if (!strict) return warnings;
  const all = blocks.join('\n');
  if (all.includes('shadow')) warnings.push({ msg: 'anti-pattern: shadow' });
  if (/\bgraph\s+(TD|TB|LR|RL|BT)\b/.test(all)) warnings.push({ msg: 'anti-pattern: use flowchart not graph' });
  return warnings;
}

/**
 * Heuristic-only verification (synchronous). Never claims more than it checked:
 * the result carries `validator: "heuristic"` and a warning saying so.
 * @param {string} input - mermaid source, or a file path when isPath is true
 * @param {boolean} isPath
 * @param {boolean} strict - also report anti-patterns (shadow, legacy graph) as warnings
 */
export function verifyMermaid(input, isPath = false, strict = false) {
  const prepared = prepare(input, isPath);
  if (prepared.error) return prepared.error;
  const warnings = [{ msg: HEURISTIC_NOTICE }, ...strictWarnings(prepared.blocks, strict)];
  for (const [i, block] of prepared.blocks.entries()) {
    const err = heuristicBlock(block);
    if (err) {
      const error = prepared.blocks.length > 1 ? { ...err, block: i + 1 } : err;
      return { ok: false, errors: [error], warnings, validator: 'heuristic' };
    }
  }
  return { ok: true, errors: [], warnings, validator: 'heuristic' };
}

let parserPromise = null;

/** Load the real parser once. Resolves to a parse function, or null when unavailable. */
function loadParser() {
  if (process.env.VERIFY_MERMAID_NO_PARSER) return Promise.resolve(null);
  if (!parserPromise) {
    parserPromise = (async () => {
      try {
        // mermaid needs a DOM even for parse(); install one before the first import.
        if (typeof globalThis.window === 'undefined') {
          const { JSDOM } = await import('jsdom');
          const dom = new JSDOM('<!doctype html><html><body></body></html>');
          globalThis.window = dom.window;
          globalThis.document = dom.window.document;
          Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
        }
        const mod = await import('mermaid');
        const mermaid = mod.default || mod;
        if (typeof mermaid.parse !== 'function') return null;
        if (typeof mermaid.initialize === 'function') mermaid.initialize({ startOnLoad: false });
        return (text) => mermaid.parse(text);
      } catch {
        return null;
      }
    })();
  }
  return parserPromise;
}

function lineFrom(error) {
  const m = String(error?.message || '').match(/line\s+(\d+)/i);
  return error?.hash?.line || (m ? parseInt(m[1], 10) : 1);
}

/**
 * Verify with the real mermaid parser when it can be loaded, block by block.
 * Falls back to {@link verifyMermaid} (validator "heuristic") when it cannot.
 */
export async function verifyMermaidWithParser(input, isPath = false, strict = false) {
  const prepared = prepare(input, isPath);
  if (prepared.error) return prepared.error;
  const parse = await loadParser();
  if (!parse) return verifyMermaid(input, isPath, strict);
  for (const [i, block] of prepared.blocks.entries()) {
    try {
      await parse(block);
    } catch (e) {
      const error = { line: lineFrom(e), col: e?.hash?.col || 0, msg: String(e?.message || e).split('\n').slice(0, 3).join(' | ') };
      if (prepared.blocks.length > 1) error.block = i + 1;
      return { ok: false, errors: [error], warnings: strictWarnings(prepared.blocks, strict), validator: 'mermaid' };
    }
  }
  return { ok: true, errors: [], warnings: strictWarnings(prepared.blocks, strict), validator: 'mermaid' };
}

// CLI handling
function isMain() {
  const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return entry === path.resolve(fileURLToPath(import.meta.url));
}

if (isMain()) {
  const args = process.argv.slice(2);
  let strict = false;
  let requireParser = false;
  let target = null;
  for (const a of args) {
    if (a === '--strict') strict = true;
    else if (a === '--require-parser') requireParser = true;
    else if (!target) target = a;
  }

  let inputData = '';
  let isPath = false;
  if (!target || target === '-') {
    try {
      inputData = fs.readFileSync(0, 'utf-8');
    } catch (e) {
      console.log(JSON.stringify(failure(e.message), null, 2));
      process.exit(1);
    }
  } else {
    inputData = target;
    isPath = true;
  }

  const result = await verifyMermaidWithParser(inputData, isPath, strict);
  if (requireParser && result.validator !== 'mermaid') {
    const refusal = {
      ok: false,
      errors: [{ line: 1, col: 0, msg: '--require-parser: the mermaid parser could not be loaded (install mermaid and jsdom)' }],
      warnings: result.warnings,
      validator: result.validator,
    };
    console.log(JSON.stringify(refusal, null, 2));
    process.exit(2);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
