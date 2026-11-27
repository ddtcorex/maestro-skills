import { describe, it, expect } from 'vitest';
import { verifyMermaid, verifyMermaidWithParser } from '../scripts/verify-mermaid.mjs';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('verify-mermaid CLI', () => {
  it('valid flowchart passes', () => {
    const r = verifyMermaid("flowchart TB\n  A-->B");
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('invalid syntax fails at line 2', () => {
    const r = verifyMermaid("flowchart TB\n  A-->");
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0].line).toBe(2);
  });

  it('reads from path when isPath', () => {
    // In maestro-skills repo CI, docs/architecture.md does not exist (it's at maestro-harness/docs).
    // Try candidate paths, fallback to temp file fixture.
    const candidates = [
      path.resolve(__dirname, '../../../../docs/architecture.md'), // old wrong path
      path.resolve(__dirname, '../../../docs/architecture.md'), // maestro-harness/docs
      path.resolve(__dirname, '../../docs/architecture.md'),
      'docs/architecture.md',
    ];
    let target = candidates.find(p => fs.existsSync(p));
    let tempFile = null;
    if (!target) {
      tempFile = path.join(os.tmpdir(), `verify-cli-test-${Date.now()}.md`);
      fs.writeFileSync(tempFile, "```mermaid\nflowchart TB\n  A-->B\n```\n");
      target = tempFile;
    }
    const r = verifyMermaid(target, true);
    expect(r.ok, `expected ok true from path ${target}, got ${JSON.stringify(r)}`).toBe(true);
    if (tempFile) try { fs.unlinkSync(tempFile); } catch {}
  });

  it('detects anti-pattern shadow when strict', () => {
    const r = verifyMermaid("flowchart TB\n  A-->B\n  style A shadow:true", false, true);
    expect(r.warnings && r.warnings.length > 0, `expected warnings for shadow, got ${JSON.stringify(r)}`).toBe(true);
  });

  it('empty input fails', () => {
    const r = verifyMermaid("");
    expect(r.ok).toBe(false);
  });

  it('heuristic mode says it is heuristic', () => {
    const r = verifyMermaid("flowchart TB\n  A-->B");
    expect(r.validator).toBe('heuristic');
    expect(r.warnings.some((w) => /heuristic/i.test(w.msg))).toBe(true);
  });

  it('heuristic catches an unclosed bracket on its line', () => {
    const r = verifyMermaid('flowchart TB\n  A["x" --> B');
    expect(r.ok).toBe(false);
    expect(r.errors[0].line).toBe(2);
  });

  it('heuristic catches an unterminated string', () => {
    const r = verifyMermaid('flowchart TB\n  A["x --> B');
    expect(r.ok).toBe(false);
    expect(r.errors[0].line).toBe(2);
  });

  it('heuristic does not flag valid shapes or brackets inside quotes', () => {
    const src = [
      'flowchart TB',
      '  A>asym] --> B([round])',
      '  B --> C[(db)]',
      '  C --> D{decide}',
      '  D --> E["label with (parens and [brackets"]',
      '  %% a comment with ( an open paren',
    ].join('\n');
    const r = verifyMermaid(src);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it('does not apply the bracket check to sequence diagrams', () => {
    const r = verifyMermaid('sequenceDiagram\n  A->>B: call (x');
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it('WithParser keeps rejecting what the heuristic rejects', async () => {
    const r = await verifyMermaidWithParser('flowchart TB\n  A["x" --> B');
    expect(r.ok).toBe(false);
    expect(['mermaid', 'heuristic']).toContain(r.validator);
  });

  it('WithParser accepts a valid multi-block file, one block at a time', async () => {
    const f = path.join(os.tmpdir(), `verify-multi-${Date.now()}.md`);
    fs.writeFileSync(f, "```mermaid\nflowchart TB\n  A-->B\n```\ntext\n```mermaid\nsequenceDiagram\n  A->>B: hi\n```\n");
    const r = await verifyMermaidWithParser(f, true);
    fs.unlinkSync(f);
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it('--require-parser exits 2 when no parser is available', () => {
    const script = path.resolve(__dirname, '../scripts/verify-mermaid.mjs');
    const r = spawnSync('node', [script, '-', '--require-parser'], {
      input: 'flowchart TB\n  A-->B',
      env: { ...process.env, VERIFY_MERMAID_NO_PARSER: '1' },
      encoding: 'utf8',
    });
    expect(r.status).toBe(2);
    expect(JSON.parse(r.stdout).errors[0].msg).toMatch(/--require-parser/);
  });

  it('CLI without --require-parser still exits 0 on valid input in heuristic mode', () => {
    const script = path.resolve(__dirname, '../scripts/verify-mermaid.mjs');
    const r = spawnSync('node', [script, '-'], {
      input: 'flowchart TB\n  A-->B',
      env: { ...process.env, VERIFY_MERMAID_NO_PARSER: '1' },
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).validator).toBe('heuristic');
  });
});

// Only runs where the real parser can be loaded (mermaid + jsdom installed next to the repo).
const parserProbe = await verifyMermaidWithParser('flowchart TB\n  A-->B');
describe.skipIf(parserProbe.validator !== 'mermaid')('verify-mermaid with the real parser', () => {
  it('rejects what only the real parser can see', async () => {
    const r = await verifyMermaidWithParser('flowchart TB\n  A ==> ==> B');
    expect(r.ok).toBe(false);
    expect(r.validator).toBe('mermaid');
  });

  it('parses each block of a file separately', async () => {
    const f = path.join(os.tmpdir(), `verify-real-${Date.now()}.md`);
    fs.writeFileSync(f, "```mermaid\nflowchart TB\n  A-->B\n```\n```mermaid\nflowchart TB\n  A ==> ==> B\n```\n");
    const r = await verifyMermaidWithParser(f, true);
    fs.unlinkSync(f);
    expect(r.ok).toBe(false);
    expect(r.errors[0].block).toBe(2);
  });
});
