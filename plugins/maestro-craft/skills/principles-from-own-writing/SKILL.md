---
name: principles-from-own-writing
description: Use when asked to build a voice, style, tone or working-principles file (voice.md and the like) so an agent writes or works like a specific person, or when given chat exports or messages to learn someone's style from.
compatibility: claude, codex, opencode, copilot, dsh
---

# Principles from your own writing

Ten principles generalise; fifty sample messages get parroted. And a file that
loads on every prompt flows into everything the agent writes, so what goes in it
must be the user's own and safe to repeat anywhere.

## Inputs: the user's own artifacts only

- Use documents the user wrote alone: reports, specs, design notes, READMEs,
  commit messages, review comments, emails they sent.
- **Never** a conversation that contains another person's messages (a chat
  export, a thread, a meeting transcript). The other person did not consent to
  being mined, and their words end up shaping every future answer. Do not
  "only use the user's lines" from such an export either: the user's replies
  are shaped by, and often quote, the other person.
- If all you were given is such a conversation, say why you will not use it and
  ask for, or propose, the user's own documents instead. Do not produce a file
  from it.
- Casual chat is also the wrong register for working output: derive from the
  kind of writing the agent will produce.

## Extract principles, not samples

- At most **twelve** rules. Each states a principle and, where useful, the reason
  ("lead with the outcome, then the evidence, because readers skim").
- No quoted sentences, no example messages, no names, no personal details.
  A rule that only makes sense with an example attached is not a principle yet.
- Cover how the person reasons and decides (evidence, risk, order of work) as
  well as how they phrase things; the first generalises further.
- Keep each rule checkable: someone reading an output can say whether it holds.

## Where the file goes

- Outside any tracked public repository, and never inside a client repository.
- A private, versioned location the user controls is best (their private config
  repo); otherwise their home config directory. Say which, and why.
- Load it from the agent's global instructions by the mechanism that agent
  supports (an import line, or an inline section), and verify on each agent that
  it actually loads by asking for one rule verbatim in a fresh session.

## Prove it changes something

Run one writing task before and after adding the file. If the difference cannot
be described in a sentence, the rules are too vague: sharpen them, do not add
more.

## Red flags

- Building from a chat export "because the user asked".
- Example sentences in the file.
- A path inside a repository that is or may become public.
- More than twelve rules.
