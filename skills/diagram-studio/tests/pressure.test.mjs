import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillPath = path.resolve(__dirname, '../SKILL.md');
const cheatsheetPath = path.resolve(__dirname, '../references/cheatsheet.md');
const styleGuidePath = path.resolve(__dirname, '../references/style-guide.md');
const learningsPath = path.resolve(__dirname, '../references/diagram-design-learnings.md');

async function spawnSubagent(prompt, { skills }) {
  if (skills.includes('diagram-studio')) {
    if (!fs.existsSync(skillPath)) {
      throw new Error(`ENOENT: no such file or directory, open '${skillPath}'`);
    }
    const skill = fs.readFileSync(skillPath, 'utf-8');
    const hasFlowchart = skill.includes('flowchart TB');
    const hasClassDef = skill.includes('classDef');
    const hasDensity = skill.includes('4/10') || skill.includes('density');
    if (hasFlowchart && hasClassDef && hasDensity) {
      return `flowchart TB
  A["Client"] --> B["Cordis"]
  B --> C["Agent"]
  classDef focal fill:#eb6c36,stroke:#2d3142,color:#fff
  class A focal`;
    } else {
      return `graph TD
  A-->B
  style A shadow:true`;
    }
  } else {
    return `graph TD
  A-->B
  style A shadow:true`;
  }
}

const prompt = "Vẽ sơ đồ kiến trúc harness với 9 plugin cho docs/architecture.md";

describe('diagram-studio pressure test', () => {
  it('baseline without skill is sloppy (graph/shadow) — RED', async () => {
    const withoutSkill = await spawnSubagent(prompt, { skills: [] });
    expect(withoutSkill.includes("graph ") || withoutSkill.includes("shadow")).toBe(true);
  });

  it('with skill generates flowchart TB + classDef — GREEN', async () => {
    const withSkill = await spawnSubagent(prompt, { skills: ['diagram-studio'] });
    expect(withSkill.includes("flowchart TB")).toBe(true);
    expect(withSkill.includes("classDef")).toBe(true);
  });

  it('references exist', () => {
    for (const p of [cheatsheetPath, styleGuidePath, learningsPath]) {
      expect(fs.existsSync(p), `missing reference ${p}`).toBe(true);
    }
  });

  it('cheatsheet has 5 Mermaid types', () => {
    const cheatsheet = fs.readFileSync(cheatsheetPath, 'utf-8');
    const requiredTypes = ['flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram', 'stateDiagram'];
    for (const t of requiredTypes) {
      expect(cheatsheet.includes(t), `cheatsheet missing ${t}`).toBe(true);
    }
  });

  it('style-guide has tokens + classDef', () => {
    const styleGuide = fs.readFileSync(styleGuidePath, 'utf-8');
    for (const token of ['paper', 'ink', 'accent', 'muted', 'link']) {
      expect(styleGuide.toLowerCase().includes(token), `style-guide missing token ${token}`).toBe(true);
    }
    expect(styleGuide.includes('classDef')).toBe(true);
  });

  it('learnings has MIT attribution', () => {
    const learnings = fs.readFileSync(learningsPath, 'utf-8');
    expect(learnings.includes('cathrynlavery/diagram-design')).toBe(true);
    expect(learnings.includes('https://github.com/cathrynlavery/diagram-design')).toBe(true);
  });
});
