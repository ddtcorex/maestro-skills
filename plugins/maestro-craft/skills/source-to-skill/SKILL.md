---
name: source-to-skill
description: Use when turning external material (videos, talks, articles, threads, a doc set) into an agent skill or a set of rules, before writing any rule from it.
compatibility: claude, codex, opencode, copilot, dsh
---

# Source to skill

Material produces opinion; a skill must carry practice. The load-bearing step is
not collecting more material, it is the screen that reduces it to rules you can
stand behind. Ten verified rules beat a thousand repeated ones.

## 1. Acquire with the cheapest faithful route

- A published subtitle or caption track first (for video sites, `yt-dlp
  --write-subs --sub-langs en --skip-download <url>`, then strip timing). It is
  the speaker's own words, offline, cheap and reproducible.
- Check the tool first: `command -v yt-dlp`. If it is not installed, say so and
  ask whether to install it (pinned, from the package manager or a release) rather
  than switching to a page reader without telling the user.
- An LLM page reader only when no track exists; note which items came that way.
- Record per item: link, date, duration, and the route used.

## 2. Reduce to claims, then to themes

Split every item into atomic claims. Merge duplicates into themes, and count a
claim that cites another item as **one** source, not two: repetition is not
confirmation.

## 3. Verify each checkable claim at its primary source

For every claim naming a product, number, benchmark or behaviour, open the
primary source (the repository, the vendor docs, the paper) and label it:

| Label | Meaning |
|---|---|
| verified | the source confirms it, link recorded |
| partly | the thing exists, but the framing or figure is not supported |
| unverified | no primary source found; never becomes a rule |

"Unverified, run an eval later" is not a verification. Look it up now, or drop
the claim. Product names heard through speech recognition are often wrong:
resolve the real name before searching.

## 4. Screen against the target environment

For each surviving theme, check what the environment the skill is for already
has. A rule that duplicates existing infrastructure (a memory system, a CI gate,
an existing skill) is dropped or rewritten to point at that infrastructure.
Reject anything that trades terms of service, third-party data or security for
convenience, whatever its source says.

Write the verdict per theme: adopt, adopt with a change, already covered, low
value, reject, each with one line of reason.

## 5. Fix a golden set, and make the method explicit

Before scaling, pick a few reference outputs that are known good. Have the model
state, in its own words, exactly how each was made; that stated method, checked
against the references, is the skill's core, not the raw material.

## 6. Write and prove the skill

- Rules only from verified claims or from the user's own evidence.
- A baseline scenario run **without** the skill first, recording what the agent
  does wrong; then the same scenario **with** it. No observed failure means no
  rule is needed.
- Keep a report beside the skill: sources, the verification table, verdicts and
  what was rejected, so the next editor can re-check it.

## Red flags

- A rule whose only support is "the creator said so".
- Two items counted as two confirmations when one repeats the other.
- A theme adopted without checking whether the environment already covers it.
- Writing the skill before any baseline run.
