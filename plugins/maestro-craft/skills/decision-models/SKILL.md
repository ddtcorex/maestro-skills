---
name: decision-models
description: Use when considering a decision model (a classifier-style API such as TypeSafe Jev) for a step in an agent or pipeline, before wiring it in, to decide whether it belongs there and to measure it against the current solution.
compatibility: claude, codex, opencode, copilot, dsh
---

# Decision models: admit, then measure

A decision model answers typed questions (`choice`, `score`, `noul`, `box`)
about a state instead of generating text. It is fast and cheap per call. That
makes it tempting to put in front of every step; speed is not accuracy, and
the only way to know is to measure on your own data.

This skill does not teach the API. For state design, question wording and
request shape, install the vendor skill: `npx skills@1.9.0 add typesafe-ai/skills`.

## 1. Admission: refuse these outright

- **Deterministic policy.** If a ruleset defines the answer, the ruleset scores
  100 percent by construction; a model can only lose.
- **Security gates.** Anything that allows or denies an action with a blast
  radius.
- **Decisions that must explain themselves** to a reviewer or an auditor.
- **Decisions made once.** The setup and measurement cost never pays back.
- **Decisions with no oracle on an automatic path.** If you cannot label a
  sample, you cannot measure it, and an unmeasured decision may only advise a
  human.

What survives: frequent, reversible, low blast radius decisions where a wrong
answer costs a retry, and where a labelled sample can be built from history.

## 2. Measurement, before any wiring

1. **Build the labelled set from real history**, about 100 rows or more, with
   the label decided by a human or by what actually happened. Never let the
   state contain the verdict (strip replies, resolutions, later comments).
2. **Write down the majority-class baseline**: the score of always giving the
   most common answer. Report every model score next to it. On a skewed set,
   use balanced accuracy, or a model that always says yes looks good.
3. **Run the incumbent on the same rows**: the chat model, heuristic or human
   step you want to replace. The question is "better than what we have", not
   "better than nothing".
4. **Run the decision model three times.** Its run-to-run spread is the noise
   floor; a gap smaller than the spread is not a result.
5. **Decide in code from probabilities.** Confidence is not a gate: it measures
   how concentrated the distribution is, not whether the answer is right.
   Sweep a threshold on the probability the code reads, and report the sweep.
6. **Read the raw response body** on every arm. A missing header or a billing
   error can come back as a body with no answers, and a script that only reads
   `answers` silently scores zero.

**Pass condition**, fixed before the run: beats the baseline and the incumbent
by more than its own spread on every run. Otherwise record the negative result
and do not wire it in.

## 3. Measured case studies

Both measured on 2026-11-28 with `jev-1.14` through the OpenCode Go route,
against `deepseek-v4.1-flash` as the incumbent. Your numbers will differ;
these show what to expect and how a result reads.

| Decision | Rows | Baseline | Decision model, 3 runs | Chat model | Verdict |
| --- | --- | --- | --- | --- | --- |
| Agent tool call tier: allow, ask, or journal, against a deterministic ruleset | 23 | 61% (always `ask`) | 65-74% accuracy | 70% | Reject: the ruleset is the oracle and scores 100% |
| Is this code review finding a real defect | 105 | 50% balanced | 55-56% balanced | 66.7% balanced | Reject: accepted 42 of 51 findings humans rejected |

What the two share: the model leaned towards the cautious or affirmative
answer on every error, it was about 6 times (tool calls) to 50 times (findings)
faster than the chat model, and both arms failed where the deciding fact (a
house-specific tier, vendor behaviour checked at runtime) was not in the state.
A decision model cannot know what its state does not say.

## 4. Endpoint is configuration

Treat the endpoint and key as configuration, never as code. On the OpenCode Go
plan the decision path is the Go prefix plus `/systemone`
(`https://opencode.ai/zen/go/v1/systemone`); the path printed in the vendor
console bills prepaid credit and answers HTTP 402 on that plan. The TypeSafe
direct API was not verified by these measurements.
