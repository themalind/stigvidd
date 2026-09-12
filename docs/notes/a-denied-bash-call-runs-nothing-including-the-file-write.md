# A guard denies the whole Bash call, so a file written earlier in that same call never exists — and the test run afterwards is green about it

`PreToolUse` hooks deny the **tool call**, not the offending segment. Anything else the call
was going to do — a heredoc writing a file, a `mkdir`, a `cp` — does not happen either. That is
obvious once stated and completely invisible in the moment, because the denial message talks
only about the command it objected to and says nothing about the rest.

## Measured here, twice, in one session

**1. Writing a test file and running the suite in one call.** The call was

```
cat > Tests/UnitTests/ServiceTests/MailTemplateRendererTests.cs <<'EOF' … EOF
dotnet test --project Tests/UnitTests/UnitTests.csproj --filter …
```

`guard-build-commands.mjs` refused it for the missing `ConnectionStrings__StigVidd`. Correct
refusal — and **the test file was never created**. The next call, with the variable set, ran
the suite and reported **1104 passed, 0 failed**.

That green run is the trap. It was green about a project that did not contain the ten tests
just "written". Nothing anywhere said a file was missing; the suite simply had nothing new in
it and passed exactly as before. It surfaced only because the next step happened to filter to
the new class and got `Zero tests ran` — without that, the session would have reported ten
tests it did not have.

**2. Prose tripping a second guard.** Writing `docs/notes/mail-templates-seeded-with-insertdata.md`
through a heredoc was denied by `guard-build-commands.mjs`, because the note's *prose*
explained scaffolding a migration and therefore contained that command in ordinary markdown.
This is [[backticks-in-prose-trip-the-long-running-guard]] on a different guard —
`guard-long-running` there, `guard-build-commands` here — so treat that note's conclusion as
applying to **every** guard, not just the dev-server one. Both notes end at the same fix: write
files with the **Write tool**, which does not go through a shell at all.

## The rule

**Never combine a file write with a command a guard might refuse.** Write files in their own
call — Write tool for anything containing prose about commands, a bare heredoc otherwise — and
run commands separately. A deny cannot be retried, so the cost of getting this wrong is not a
retry; it is a file that silently does not exist.

## What makes it dangerous rather than annoying

A missing *source* file fails the build loudly. A missing *test* file fails nothing: the suite
compiles, runs and passes. The absence of a test is not an error condition anywhere in the
toolchain, so the only signal is a number you have to already know the expected value of.

So, after adding tests: **check the total moved.** 1104 → 1114 for ten new tests is the
evidence that they exist; "Passed!" is not. The same reasoning as the
`prove-it-bites` skill, one step earlier — before asking whether a test bites, confirm the
test is there at all.

Related: [[backticks-in-prose-trip-the-long-running-guard]], [[agent-harness-hooks]],
[[dotnet-test-connection-string]] for the other way a test run reports something other than
what is in the working tree (a stale DLL under `--no-build`).
