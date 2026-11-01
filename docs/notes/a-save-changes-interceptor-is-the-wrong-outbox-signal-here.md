<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# A SaveChanges interceptor is the wrong place to poke the domain-event dispatcher, because the test host drops it and it fires before the commit

The tidy-looking design for the [domain event outbox](../events.md) is a `SaveChangesInterceptor`
that notices a `DomainEventRecord` was added and pokes the dispatcher, so no repository can forget
to. It was designed, reviewed and rejected before any code was written. Two things make it wrong in
this repo, and neither shows on a healthy machine.

**1. The integration test host removes it.** `StigViddWebApplicationFactory` deletes the
`IDbContextOptionsConfiguration<StigViddDbContext>` descriptor
(`backend/Tests/IntegrationTests/WebApplicationFactory.cs`, the first lines of `ConfigureWebHost`)
and re-registers `AddDbContextFactory` with `UseSqlite`. An interceptor added in
`AddStigVidd` with `AddInterceptors` lives in the options configuration that is removed, so it is
silently absent in every integration test. The suite stays green while the one behaviour it was
meant to cover never runs. Nothing in `Core` adds an interceptor today, so nothing else would
notice.

**2. `SavedChanges` fires before `CommitAsync` under an explicit transaction.**
`AccountDeletionRepository` opens `BeginTransactionAsync` and saves many times inside it. An
interceptor poking on `SavedChangesAsync` would wake the dispatcher while the row is still
uncommitted and invisible to it. That breaks rule 1 of
[[in-memory-queue-in-front-of-a-database-journal]], write then signal, and the failure is a
lost-wakeup race that no test on an idle machine reproduces.

**What was built instead:** an explicit `IDomainEventSignal.Poke()` placed after the commit, by the
publisher or by the repository. A forgotten poke costs at most `DomainEvents:PollIntervalSeconds`
of latency, because the dispatcher also wakes on a tick and claims whatever is due. It never costs
an event.

If you reconsider this, the test that has to exist first is one that runs the interceptor inside
the integration factory. Without it you cannot tell whether it fired.
