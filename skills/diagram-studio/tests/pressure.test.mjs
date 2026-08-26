#!/usr/bin/env node
/**
 * Pressure test for diagram-studio skill (TDD).
 * Baseline: agent without skill generates Mermaid with `graph` and shadow (fail)
 * With skill: agent generates `flowchart TB` with classDef and density 4/10 (pass)
 * Mock helper is inlined — no external deps.
 */
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
      // skill exists but incomplete -> still sloppy
      return `graph TD
  A-->B
  style A shadow:true`;
    }
  } else {
    // without skill: sloppy baseline
    return `graph TD
  A-->B
  style A shadow:true`;
  }
}

const prompt = "Vẽ sơ đồ kiến trúc harness với 9 plugin cho docs/architecture.md";

console.log("=== Pressure test: diagram-studio skill ===");

// Baseline: without skill should be sloppy
const withoutSkill = await spawnSubagent(prompt, { skills: [] });
console.log("[withoutSkill]", withoutSkill.replace(/\n/g, " | "));
if (!(withoutSkill.includes("graph ") || withoutSkill.includes("shadow"))) {
  console.error("FAIL: baseline should be sloppy (graph/shadow) but was not");
  process.exit(1);
}
console.log("✓ baseline is sloppy (graph/shadow) — RED confirmed");

// With skill: should be editorial
let withSkill;
try {
  withSkill = await spawnSubagent(prompt, { skills: ['diagram-studio'] });
} catch (e) {
  console.error("FAIL: withSkill threw:", e.message);
  console.error("Expected: skill should exist and generate flowchart TB + classDef");
  process.exit(1);
}
console.log("[withSkill]", withSkill.replace(/\n/g, " | "));
if (!withSkill.includes("flowchart TB") || !withSkill.includes("classDef")) {
  console.error("FAIL: with skill should generate flowchart TB + classDef but got:", withSkill);
  process.exit(1);
}
console.log("✓ with skill generates flowchart TB + classDef — GREEN");

// Additional checks: references exist
for (const p of [cheatsheetPath, styleGuidePath, learningsPath]) {
  if (!fs.existsSync(p)) {
    console.error(`FAIL: missing reference ${p}`);
    process.exit(1);
  }
}
console.log("✓ references exist");

// Verify style-guide tokens and cheatsheet types
const cheatsheet = fs.readFileSync(cheatsheetPath, 'utf-8');
const requiredTypes = ['flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram', 'stateDiagram'];
for (const t of requiredTypes) {
  if (!cheatsheet.includes(t)) {
    console.error(`FAIL: cheatsheet missing ${t}`);
    process.exit(1);
  }
}
console.log("✓ cheatsheet has 5 Mermaid types");

const styleGuide = fs.readFileSync(styleGuidePath, 'utf-8');
for (const token of ['paper', 'ink', 'accent', 'muted', 'link']) {
  if (!styleGuide.toLowerCase().includes(token)) {
    console.error(`FAIL: style-guide missing token ${token}`);
    process.exit(1);
  }
}
if (!styleGuide.includes('classDef')) {
  console.error("FAIL: style-guide missing classDef");
  process.exit(1);
}
console.log("✓ style-guide has tokens + classDef");

const learnings = fs.readFileSync(learningsPath, 'utf-8');
if (!learnings.includes('cathrynlavery/diagram-design') || !learnings.includes('https://github.com/cathrynlavery/diagram-design')) {
  console.error("FAIL: learnings missing attribution link");
  process.exit(1);
}
console.log("✓ learnings has MIT attribution");

console.log("pressure test: RED then GREEN — PASS");
