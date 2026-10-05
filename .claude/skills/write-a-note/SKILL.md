---
name: write-a-note
description: Record a session's learning where the next session finds it cheapest — a CLAUDE.md line, a skill step, a hook check, or a findable docs/notes/ entry. Use when the plan-eval retro asks what would have skipped a cost, when a doc or skill was wrong, when --report lists a note to promote, or before ending with an unrecorded fact.
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

## Where it goes: the cheapest place it will be found

A note is the most expensive home a fact can have, because every session has to be shown it,
open it and read it. Before writing one, go down this ladder and stop at the first rung that
fits:

| rung | when | cost to the next session |
| --- | --- | --- |
| a CLAUDE.md line | it changes a decision every time in that area | none, it is always loaded |
| a skill step | it belongs to a procedure (`add-an-endpoint`, `add-a-migration`, …) | none once the skill loads |
| a hook check | a machine can detect the mistake | none, the hook says it at the moment it matters |
| a note | a mechanism, a measurement, a rejected design | a recall, an open, a read |

A **cost** lesson, the answer to the retro's "what would have let you skip that?", records
the shortcut: the path, symbol, command or `--match` query that leads straight there. It does
not record the story of the search.

## Promoting a note

`node .claude/hooks/plan-eval.mjs --report` lists the notes opened in 3+ sessions. Every one of
those sessions paid to re-read a rule. To promote one:

1. Write the rule, in one or two lines, on the highest rung above that fits.
2. Shrink the note to its evidence: what was measured, and why the wrong thing looks right.
   Keep its INDEX.md line, so the *why* is still recallable.
3. Cite the note from where the rule now lives.

The report's **noisy recalls** are the opposite case: notes shown 3+ times and never opened.
Their INDEX.md line matches too broadly. Rewrite it around the note's own vocabulary.

## The INDEX.md line is what makes it findable

`plan-eval` matches every prompt and every approved plan against the **index text**, not the
note bodies. So the
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

**No square brackets in the link text.** Markdown link text does not nest them, so a title
like `An [Authorize(Policy = "...")] name that ...` breaks the index line's parse: the note
is written, the line is there, and `--check-notes` still reports it "is in no INDEX.md line
— it is unreachable", naming nothing about brackets. Write the attribute without them
(`An Authorize policy name that ...`) in both the title and the index line.

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
