---
name: write-a-note
description: Record what a session learned as a docs/notes/ entry that will actually be found again — the file, its INDEX.md line, and the citation that makes it reachable. Use when plan-eval's round 2 asks what surprised you, when a doc comment or a skill turned out to be wrong, and whenever you are about to end a session holding a measured fact that exists nowhere but this context.
---

# Writing a note that gets read

[docs/notes/](../../../docs/notes/) is this repo's memory. A note has three parts and **all
three are load-bearing**:

| part | without it |
| --- | --- |
| the file, `docs/notes/<slug>.md` | nothing to find |
| its line in [INDEX.md](../../../docs/notes/INDEX.md) | `--check-notes` fails, and matching cannot see it |
| a citation from the code, a skill or CLAUDE.md | nothing leads a session to it in the first place |

The first two are gated by `node .claude/hooks/plan-eval.mjs --check-notes`, which
`scripts/check-hooks.mjs` runs. The third is not gated and is the one that decides whether
anyone ever reads it.

## What is worth a note

Something **measured** that is not derivable from the code:

- a failure mode whose symptom points somewhere other than its cause (the contract test
  rewriting a file; a missing DI registration surfacing as a whole-suite failure);
- a per-platform difference and its mechanism;
- a signal that does not cover what it appears to cover ("`dotnet test` says nothing about
  `web/`");
- a design that was tried and rejected, with the measurement — so it is not re-proposed;
- a claim in a doc comment, a doc, or a skill that turned out to be false.

**Not** worth a note: what the code says plainly, what `git log` records, a summary of a
change you just made, or anything that is only true within one conversation.

## The INDEX.md line is what makes it findable

`plan-eval` matches an approved plan against the **index text**, not the note bodies. So the
summary has to carry the note's vocabulary: the file paths, the command names, the error
text, the concepts. A bare title is a note nothing will ever recall — `--check-notes` fails
a summary under 40 characters for that reason, and 40 is a floor, not a target.

```markdown
- [The claim, stated as a fact, not a topic](slug.md) —
  what it actually is, in two or three sentences that name the files, commands and error
  messages involved, so a plan mentioning any of them matches.
```

Title the note as a **claim**: "In a linked worktree `.git` is a FILE" beats "Worktrees".
The title's tokens are weighted triple in matching.

## The file

Keep one fact per file. Say what was measured and where, cite the source with a relative
link, and link related notes with `[[slug]]`. A note that explains *why* the wrong thing
looks right is worth more than one that only states the right thing — the reader is arriving
with the wrong model, and that is what has to be dislodged.

## Then make it reachable

Pick at least one:

- cite it from the code that embodies it — the comment block in a hook, an `// see` beside
  the surprising line;
- cite it from the skill whose step it belongs to;
- add it to a CLAUDE.md section if it is a rule rather than an incident.

## Writing the file: use the Write tool, not a heredoc

A note about a dev server, a watcher or a compose command has to *name* it, and markdown
names things in inline code. Inside a shell heredoc that is a problem: the backtick is real
command substitution, so `guard-long-running.mjs` starts a new command segment there and
denies the write — for a file that runs nothing. The denial quotes prose back at you, which
is the tell. Use the Write tool; it does not go through a shell.
See [backticks-in-prose-trip-the-long-running-guard](../../../docs/notes/backticks-in-prose-trip-the-long-running-guard.md).

## Check it

```sh
node .claude/hooks/plan-eval.mjs --check-notes
node .claude/hooks/plan-eval.mjs --match "<words from the task that should find it>"
```

The second is the real test: if the note does not come back for the query a future session
would plausibly type, the index line is wrong, not the searcher.
