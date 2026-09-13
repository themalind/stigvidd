# xUnit1051 only flags a token you left OFF, so 792 `CancellationToken.None` calls sat behind a 0-warning build

`xunit.v3` 3.2.2 pulls in `xunit.analyzers` 1.27.0, which ships **xUnit1051** — "calls to
methods which accept CancellationToken should use `TestContext.Current.CancellationToken`".
It is on by default at severity *warning*, and it works. It is also much narrower than its
name suggests.

## What it sees, measured

A probe file in `Tests/UnitTests` with three shapes, built with `--no-incremental`:

```csharp
[Fact] public async Task OmittedToken()  => await Task.Delay(1);                        // line 9
[Fact] public async Task ExplicitNone()  => await Task.Delay(1, CancellationToken.None);
[Fact] public async Task ViaHelper()     => await Helper();
private static async Task Helper()       => await Task.Delay(1);
```

The build reported **one** diagnostic, at line 9. The analyzer fires on the *omitted
optional parameter* and nothing else:

| shape | flagged |
| --- | --- |
| token argument left off entirely | **yes** |
| `CancellationToken.None` passed explicitly | no |
| `new CancellationToken()` / `default(CancellationToken)` | no |
| any of the above inside a non-`[Fact]` helper in the same file | no |

## Why that mattered here

`cd backend && dotnet build` reported **0 Warning(s)** across the whole solution while
`backend/Tests` held **792 occurrences of `CancellationToken.None` across 37 files** — every
Act line in the unit and integration suites. Every one supplied an argument, so every one
read as clean. A green, warning-free build was not evidence of anything about cancellation.

The fix was a sweep to `TestContext.Current.CancellationToken` (1720 tests still pass).
Worth knowing for the sweep itself: no occurrence was inside a Moq `Setup`/`Verify`
expression tree and none was in a fixture or helper file, which is what made a blanket
`sed` safe. The `=>` hits a first grep turns up are **selector lambdas**
(`hs => hs.HikeId`) in repository calls, not Moq.

## What now enforces it

Two instruments, because neither covers the other's half:

- **The analyzer, raised to an error.** `.editorconfig` carries
  `dotnet_diagnostic.xUnit1051.severity = error` under `[backend/Tests/**.cs]`. Verified by
  the probe: the same diagnostic goes from `warning` to `error` and the build FAILs. An
  error rather than a warning because a warning here is invisible — the build prints only
  an aggregate count and nothing in CI fails on it.
- **`.claude/hooks/guard-test-cancellation-token.mjs`** for the blind spot: a PreToolUse
  deny on writing `CancellationToken.None`, `new CancellationToken()` or
  `default(CancellationToken)` into `backend/Tests/**.cs`. It deliberately does **not**
  duplicate the omitted-token case — the analyzer catches that at build time, which beats
  any hook. Escape hatch for a test genuinely about the never-cancelled token:
  `// cancellation-token-ok: <why>` on the line.

The guard does not flag `CancellationTokenSource`, which is how a test *about* cancellation
is written, nor `It.IsAny<CancellationToken>()`, which is the right Moq idiom.

## The trap when scoping the analyzer setting

Do **not** reach for a `backend/Tests/Directory.Build.props` to scope this. MSBuild takes
the **nearest** `Directory.Build.props` and stops walking, so adding one under `Tests/`
silently drops `backend/Directory.Build.props`'s `WarningsAsErrors=nullable` for exactly the
projects you were tightening. An `.editorconfig` section composes instead of replacing.

Related: [[agent-harness-hooks]], [[fluentassertions-8-is-not-free-software]],
[[dotnet-test-connection-string]].
