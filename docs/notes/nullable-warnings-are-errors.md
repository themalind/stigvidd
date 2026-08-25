# In backend/, a nullable warning is a build ERROR

[`backend/Directory.Build.props`](../../backend/Directory.Build.props) is three lines:

```xml
<PropertyGroup>
  <WarningsAsErrors>nullable</WarningsAsErrors>
</PropertyGroup>
```

It applies to every project under `backend/`. So `CS8602` (dereference of a possibly null
reference), `CS8618` (non-nullable field uninitialised), `CS8600` and the rest of the
nullable family do not produce a warning you can finish the task and come back to — they
fail the build.

This matters mostly for *pace*. The feedback loop for a nullable slip is otherwise the
next `dotnet test`, which is minutes away and buried in unrelated output, and a session
that has just written five files does not know which one. Confirmed by planting
`int Length(string? s) => s.Length;` in `Core/`:

```
Core/Spatial/ZzTemp.cs(4,46): error CS8602: Dereference of a possibly null reference.
```

`error`, not `warning`.

`.claude/hooks/check-dotnet-build.mjs` builds the owning project after each `.cs` edit
(~1-2 s warm, 5 s cold, measured in this tree) and reports the errors in the file you just
touched, for exactly this reason. Note also that MSBuild prints each diagnostic twice, so
anything parsing that output has to deduplicate or it doubles every count it reports.

Related: [[agent-harness-hooks]].
