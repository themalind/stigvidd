# An in-memory queue is safe in front of a database journal only if you write-then-signal, re-signal on boot, and claim in the database

The mail outbox uses a `Channel<int>` for triggering and the `OutboxEmails` table for
durability. That combination is only correct because of three rules, and dropping any one of
them produces a failure that testing on a healthy machine will not show.

`TrailImportAnalysisQueue` is the same channel, deliberately *without* these rules — its work
is a session that may legitimately be lost on restart, and the worker just marks orphans
`Failed`. Mail cannot be lost, which is what forces the extra structure.

## The three rules

**1. Write, then signal.** Commit the row, *then* put its id on the channel. A hosted service
reading an id the inserting transaction has not committed gets `NotFound` and drops the work —
and the row then stays `Pending` forever, because the only thing that would have re-signalled
it already did.

**2. Every boot re-signals the journal.** The dispatcher's first act is to move `Sending` rows
back to `Pending` (a restart orphaned them) and then push **every** `Pending` id onto the
channel — including rows whose retry backoff has not expired. This is what turns a lost signal
into lost *latency*: any row the database still calls outstanding gets another chance. Without
it a crash between insert and send strands a mail permanently, which no test on a process that
never dies will ever show.

**3. Claim in the database, not in memory.** Claiming is a `Pending` → `Sending` transition
guarded by the current status. A duplicate signal — and rule 2 guarantees duplicates, since a
restart re-signals ids that may still be sitting in the channel — then finds the row is not
`Pending` and does nothing. Without this, rule 2 sends some mail twice, which is worse than the
problem rule 2 solves.

Rule 3 is the same guard `TrailImportService` applies by setting `Status = Analyzing` before
`Enqueue`, for the same reason.

## Retry timers are best-effort, and must be

A transient failure schedules a `Task.Delay` that re-signals the id. That timer dies with the
process and is *deliberately* not made durable: rule 2 already recovers the row. Trying to make
the timer reliable is rebuilding the journal in memory, badly.

The corollary is a real test: **kill the process during a backoff and the mail must still go
out.** It is the one case that separates this design from a polling loop, and the only way to
see rule 2 working.

## What to check when reviewing one of these

- Is the signal strictly after the commit?
- Does startup re-signal rows that are not yet *due*, not just rows that are ready? Filtering
  the recovery sweep by `NextAttemptAt <= now` is the easy mistake, and it strands every
  backed-off row until the next restart.
- Does claiming return a distinct "someone else has it" result that the caller treats as
  success-and-skip, rather than as an error worth logging?
- Does releasing an undue row leave `Attempts` and `NextAttemptAt` alone? Re-using the failure
  path there burns a retry and rewrites the backoff the row is still serving.

All four are covered in `Tests/UnitTests/RepositoryTests/MailOutboxRepositoryTests.cs` and
`Tests/UnitTests/ServiceTests/MailOutboxServiceTests.cs`, and each was mutation-checked per the
`prove-it-bites` skill — every rule above has a test that goes red when the rule is removed.

Single-instance assumption throughout: claiming is a read-then-update, not `SELECT … FOR UPDATE
SKIP LOCKED`, and the channel is per-process. Same caveat `TrailImportAnalysisWorker` carries.

Related: [[mail-templates-seeded-with-insertdata]], and `docs/mail.md` for the whole flow.
