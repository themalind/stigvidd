<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Domain events

How the API records that something happened and reacts to it later: an **event outbox** in the
`DomainEvents` table, drained by a background service that wakes on a poke rather than polling
hard. The table is both the work queue and the history.

It is the same shape as the [mail outbox](mail.md), generalised: one table, one claim rule, one
retry ladder, and a handler interface instead of an SMTP sender. No broker, no library. MediatR
persists nothing. MassTransit with RabbitMQ is a broker for one API container. Wolverine cannot run
its durable path on the in-memory SQLite the test suite uses, and deletes handled envelopes after
minutes, so it is not a history.

Nothing raises an event in production yet. The first consumers are expected to be the push
notifications for friend requests and shared hikes, which today run inline and best-effort.

## Raising one

An event is a record with a stable name:

```csharp
[DomainEventName("friend-request.accepted")]
public sealed record FriendRequestAccepted(int RequesterId, int ReceiverId) : IDomainEvent;
```

The name is what is stored. Renaming the class strands nothing; renaming the **name** does, so a
breaking payload change gets a new name rather than a version number.

**Identifiers only in the payload, never a name or an e-mail address.** The row can outlive the
account it mentions by up to the retention period, so it must not identify anyone on its own.

There are two ways to raise one.

**Atomically, from a repository**, so the event commits with the write it describes:

```csharp
friendRequest.Status = FriendRequestStatus.Accepted;
context.AddDomainEvent(new FriendRequestAccepted(requesterId, receiverId), entityKey: $"user:{requesterId}");
await context.SaveChangesAsync(ctoken);   // the change and its event commit together
_signal.Poke();                            // AFTER the commit, never before
```

**Standalone**, when there is no database write to ride on:

```csharp
await _publisher.PublishAsync(new SomethingHappened(id), ctoken, entityKey: $"hike:{id}");
```

`PublishAsync` writes the row, then pokes. It returns the row's `Identifier`, and fails with 500,
having stored nothing, if the write fails.

`entityKey` is optional free text such as `user:123`, cut to 100 characters, there so the history can
be filtered by what an event was about. It is not called a subject, because in this codebase that means the Keycloak
subject id.

## Handling one

```csharp
public class FriendRequestAcceptedPushHandler : IDomainEventHandler<FriendRequestAccepted>
{
    public async Task<Result> HandleAsync(FriendRequestAccepted @event, CancellationToken ctoken) { ... }
}
```

Handlers are found by an assembly scan of `Core` and registered transient in `AddStigVidd`. **An
event or handler outside the `Core` assembly is not found**: it would publish, then be parked as an
unknown type on its first pass. Event names are at most 100 characters, which the scan enforces. The
same scan builds the registry of event names and **throws on a duplicate name or an event without
the attribute**, so the host fails to start instead of a row failing later. It has to scan eagerly:
`ValidateOnBuild` validates descriptors and never runs a constructor, so a lazily built registry
would not be checked. See
[validateonbuild-does-not-run-constructors-so-a-registry-must-scan-eagerly](notes/validateonbuild-does-not-run-constructors-so-a-registry-must-scan-eagerly.md).

The rules a handler lives by:

- **At-least-once.** A failure, an exception or a timeout retries, so a handler must be idempotent.
  A device may see a duplicate push if the process dies between the Expo call and the row being
  marked handled.
- **Every handler runs.** If one of two handlers fails, the other still runs, and the row records
  which succeeded in `CompletedHandlers`. A retry runs only the rest. The key is the handler's type
  name, which is safe because the whole retry window is about 15 minutes at the default five attempts.
- **Return `Result.Fail` or throw to retry.** There is no "permanent failure" for a handler in v1.
  An unknown event name or an unreadable payload is parked as `Failed` on the first pass.
- **A missing user is `Result.Ok()`.** Account deletion does not touch event rows, so a pending
  event can name a user who is gone. There is nobody to notify, and burning five retries on it
  helps nobody.
- **A handler is bounded** by `DomainEvents:HandlerTimeoutSeconds`. Hitting it is an ordinary
  failure that retries. A handler that ignores its cancellation token cannot be interrupted: half
  the timeout again after it fires, the processor abandons the call and moves on, but the handler
  keeps running in the background with its scope disposed only when it finally returns, so honour
  the token.
- **No handlers is fine.** An event nobody handles is marked `Handled` at once and stays as history.
- `LastError` holds the exception type and message with e-mail addresses scrubbed, joined with
  ` | ` across failed handlers, cut at 2000 characters. It lives for the retention period, so do
  not put anything in an exception message you would not put in a log.

## The outbox and why it is shaped this way

The three rules of [in-memory-queue-in-front-of-a-database-journal](notes/in-memory-queue-in-front-of-a-database-journal.md)
apply here unchanged:

1. **Write, then signal.** The row commits, and only then does anything poke the dispatcher.
2. **Every start re-signals.** The dispatcher's first act is to move `Processing` rows back to
   `Pending` and poke. Because it then claims whatever is due, a row part way through a backoff is
   picked up when its time comes, never stranded. Each interruption counts as an attempt, and a row
   interrupted `MaxAttempts` times is parked as `Failed`, so a payload that crashes the process
   cannot loop across restarts. If the reset itself fails it is retried at the start of the next pass.
3. **Claim in the database.** `Status` is an EF concurrency token, so every update carries
   `AND Status = @original`. A writer that lost a race gets `DbUpdateConcurrencyException`, which
   the claim skips and every tracked update turns into `Conflict`. `MarkHandled` and `MarkFailed` also
   select only a `Processing` row, so a rival that moved it while the handlers ran (a cancel, say)
   is never overwritten: the token alone would only cover the instant between read and write.

Two differences from the mail outbox:

- **The poke carries no id.** It is a bounded channel of one that drops further writes, so many
  pokes coalesce into one wake, a poke during a pass is kept for the next wait, and publishers never
  need an id. The table says what is due; the poke only says "look now".
- **A tick replaces per-row timers.** The loop also wakes every `PollIntervalSeconds`, claims what
  is due, and drains while full batches keep coming. That removes the mail outbox's best-effort
  `Task.Delay` timers and its release of not-yet-due rows, and it means a forgotten or lost poke
  costs at most one interval of latency, never an event.

**Why an explicit poke and not a `SaveChanges` interceptor.** An interceptor looks tidier, and was
rejected for two verified reasons, written up in
[a-save-changes-interceptor-is-the-wrong-outbox-signal-here](notes/a-save-changes-interceptor-is-the-wrong-outbox-signal-here.md). The integration test factory replaces the DbContext options, so
an interceptor wired in `Core` would silently be absent from every test. And `SavedChanges` fires
before `CommitAsync` under an explicit transaction, which would poke before the row is visible and
break rule 1.

A row left `Processing` after a failed `MarkHandled` or `MarkFailed` is recovered only at the next
restart, exactly as for mail. The cost is that its handlers may run again. An unexpected exception
on one row (a handler whose constructor throws, say) is caught per row and recorded as an ordinary
failure, so it burns an attempt and parks after `MaxAttempts` instead of stranding the rest of the batch.

On shutdown the stopping token is rethrown by the repository and the processor, not logged as an
error, and no further row's handler is started once it is cancelled.

**This assumes a single API instance.** Claiming is read-then-update, not `SELECT … FOR UPDATE SKIP
LOCKED`, and the signal is per-process. The concurrency token is insurance against a second writer,
such as a future admin cancel or a second instance, not something a single instance exercises.

Retries back off 1, 2, 4, 8, 16 minutes, capped, up to `DomainEvents:MaxAttempts` before the row is
parked as `Failed` with `LastError` kept. At the default of five the fifth failure parks the row, so
only the first four waits (15 minutes) happen; the 16-minute step needs a higher `MaxAttempts`.

If a claim fails part way through a batch, the rows already claimed are returned and processed, and
the rest stay `Pending`; if it fails on the first row the pass returns nothing and the next tick retries.

## Configuration

Everything is under `DomainEvents` in `appsettings.json`. Environment variables use a double
underscore, for example `DomainEvents__RetentionDays`. A zero or negative value falls back to the
default rather than meaning "never wait" or "delete everything".

| key | default | |
| --- | --- | --- |
| `DomainEvents:MaxAttempts` | 5 | attempts before a row is parked as `Failed` |
| `DomainEvents:BatchSize` | 50 | rows claimed per pass; the loop drains while a full batch comes back |
| `DomainEvents:PollIntervalSeconds` | 30 | the safety tick; the longest a lost poke can cost |
| `DomainEvents:HandlerTimeoutSeconds` | 60 | per event, across all its handlers |
| `DomainEvents:RetentionDays` | 90 | settled rows are deleted this long after they settled |
| `DomainEvents:RetentionIntervalHours` | 24 | how often the retention sweep runs |

## Retention

`DomainEventRetentionService` deletes `Handled`, `Failed` and `Cancelled` rows once `SettledAt` is
older than `RetentionDays`. `Pending` and `Processing` rows are never purged: they are work.

`SettledAt` is set by exactly those three terminal transitions and by nothing else, and the sweep
dates rows by it rather than by `LastUpdatedAt`, which every claim and retry rewrites. See
[a-retention-clock-must-not-be-a-column-everything-writes](notes/a-retention-clock-must-not-be-a-column-everything-writes.md).

Account deletion does not touch event rows. Payloads hold surrogate integer ids that are never
reused, so after deletion a row points at nobody, and it is gone within the retention period. 90
days rather than the mail outbox's 30, because this table is also the operational history.

A data import pauses the dispatcher and the retention service through `IMaintenanceGate`, like
every other background service. A production dump restored into staging has its pending events
deleted, so staging never replays production's work, and an anonymised export has the table emptied.

## Testing

`Tests/UnitTests/Events` covers the processor, the registry, the signal, the dispatch loop and the
publisher; `Tests/UnitTests/RepositoryTests/DomainEventRepositoryTests` covers claiming, backoff,
the settled rule and the concurrency token. The InMemory provider cannot interleave two writers, so
the race is staged by hand: a `SaveChangesInterceptor` flips the row through a second context at the
moment the first one saves.

`Tests/IntegrationTests/Events` publishes through the real container on SQLite, runs one processor
pass, and exercises the purge, which uses `ExecuteDelete` and so cannot run in the unit suite.

The dispatcher and retention service are removed from the integration test host, like every other
hosted service, so tests drive `IDomainEventProcessor.ProcessDueAsync` directly. A new hosted
service must be added to the exclusion list in `WebApplicationFactory.cs` in the same change.

## Where the code is

| | |
| --- | --- |
| `Infrastructure/Data/Entities/DomainEventRecord.cs` | the table |
| `Core/Events/` | contracts, registry, serializer, signal, publisher, processor, dispatch loop |
| `Core/Repositories/DomainEventRepository.cs` | claiming, marking, purge |
| `StigviddAPI/BackgroundServices/DomainEventDispatcher.cs` | the hosted loop |
| `StigviddAPI/BackgroundServices/DomainEventRetentionService.cs` | the retention sweep |
| `Core/Services/DataTransfer/DataAnonymizer.cs` | empties the table in exports, drops pending rows on import |

## Not built yet

- **First consumers.** Push notifications for friend requests and shared hikes, raised atomically
  from `FriendRepository` and `HikeShareRepository`.
- **An admin page.** List, filter, retry and cancel, mirroring the mail outbox. The `Cancelled`
  status exists for it and nothing writes it yet.
- **Metrics.** A counter needs attribute names the retention guard accepts; see
  [metric-attribute-names-trip-the-retention-guard](notes/metric-attribute-names-trip-the-retention-guard.md).
