---
name: prove-it-bites
description: Prove that a test, assertion or guard you just wrote actually fails when the thing it guards is broken. Use AFTER writing any new xunit test, jest test, validator rule or hook self-test in this repo, and BEFORE citing it as evidence that a change works — and whenever something went green on the first try.
---

# A test that has never failed is not evidence

An assertion that passed on the first attempt feels like success and is equally consistent
with **the assertion being unable to fail at all**. Later sessions will quote it. This repo
has several shapes where that happens quietly.

The procedure is always the same and takes a minute: **break the thing the test guards,
watch the test go red, restore it.** Not "reason about whether it would fail".

## The shapes that go vacuously green here

**An integration test whose route is never hit.** A wrong `[Route]`, a missing
`[HttpPost]`, a DTO the model binder cannot bind — several of these produce a 404 or a 400
that a test asserting only "not null" or "no exception" happily accepts. Assert the **status
code** and a field of the body, then prove it: change the route by one character and confirm
the test fails on the status, not on a null reference.

**A service or repository that was never registered.** `Core/ServiceCollectionExtensions.cs`
registration is by hand, and a unit test that news up the service directly passes without
it. Only the integration test catches the DI gap — so if you added a service, the proof is
that the *integration* suite goes red when you comment the `AddTransient` line out.

**A validator that never runs.** FluentValidation validators are auto-registered by
assembly scan, so one in the wrong assembly is silently never invoked and the endpoint
accepts anything. Prove it from the *endpoint*, not from the validator class: post an
invalid body through the integration test and confirm a 400. A unit test on the validator
passes either way and proves nothing about wiring.

**A geometry assertion that cannot see an SRID.** Comparing coordinates passes whether the
SRID is 4326 or 0. Assert the SRID itself if that is what the change is about
([srid-4326](../../../docs/notes/srid-4326.md)).

**A nullable-reference fix.** `WarningsAsErrors=nullable` means the compiler is the test.
The proof is that reverting the fix fails the **build** — if it does not, the fix was not
about nullability.

**A hook guard.** A guard's self-test that only asserts the positive cases is the classic
vacuous gate: it stays green while the guard silently matches nothing. Every guard here
asserts both directions and both path separators; see
[add-a-hook](../add-a-hook/SKILL.md).

## How to break it, per stack

```sh
# backend — comment out the guard, or invert a condition, then:
cd backend && ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build

# app
cd app && npm test -- --watchAll=false

# a hook
node .claude/hooks/<name>.mjs --self-test
node scripts/check-hooks.mjs
```

Read the failure message. A test that fails for the **wrong reason** — a
`NullReferenceException` where you expected an assertion about a status code — is still not
evidence: it means the test reaches a different failure before it reaches the thing you care
about, and it would go green again for reasons unrelated to the fix.

## Then restore, and check you did

```sh
git diff        # the planted defect must not be in the diff you commit
```

A planted defect left in the tree is worse than no test at all.
