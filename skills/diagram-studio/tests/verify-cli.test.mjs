import { describe, it, expect } from 'vitest';
import { verifyMermaid } from '../scripts/verify-mermaid.mjs';
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
});
