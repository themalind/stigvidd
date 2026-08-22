# `dotnet test` needs ConnectionStrings__StigVidd, or every integration test fails at startup

[`Program.cs`](../../backend/StigviddAPI/Program.cs) resolves the database connection
eagerly:

```csharp
var connectionString = builder.Configuration.GetConnectionString("StigVidd")
    ?? throw new InvalidOperationException("Connection string 'StigVidd' not found.");
```

The integration tests boot the real host through `StigViddWebApplicationFactory`, so with
the variable unset **every one of them fails at host construction**, before touching any
code under test. Nothing in the output says "you forgot an environment variable" — you get
a wall of `InvalidOperationException`, and the suite you were about to trust looks broken.

`WebApplicationFactory` replaces the `DbContext` with SQLite in-memory regardless, so the
value only has to satisfy the null-check. `DataSource=:memory:` is what both
[.github/workflows/ci.yml](../../.github/workflows/ci.yml) and the
[Jenkinsfile](../../Jenkinsfile) use.

## The form differs per shell, and two of the three are wrong on any given box

```
bash / Git Bash   ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build
PowerShell        $env:ConnectionStrings__StigVidd="DataSource=:memory:"; dotnet test --no-build
cmd               set ConnectionStrings__StigVidd=DataSource=:memory: && dotnet test --no-build
```

The double underscore is .NET's configuration separator for `ConnectionStrings:StigVidd`;
a single underscore does not bind.

## Naming one test project needs `--project`

`backend/global.json` selects the **Microsoft.Testing.Platform** runner, and under it the
familiar `dotnet test <path/to.csproj>` is refused outright:

```
Specifying a project for 'dotnet test' should be via '--project'.
```

with a non-zero exit and no test run at all — which reads like a build failure. Use:

```sh
dotnet test --project Tests/IntegrationTests/IntegrationTests.csproj --no-build
```

A bare `dotnet test` from `backend/` runs the whole solution and is fine.

Shell state does **not** persist between Claude Code Bash tool calls, so an `export` in an
earlier call is already gone by the next one. That is what makes
`.claude/hooks/guard-build-commands.mjs` able to decide this rather than guess: what the
command itself assigns, plus the hook's own environment, is the whole of what that
`dotnet test` will inherit.

Related: [[spatialite-per-os]], [[openapi-contract-snapshot]].
