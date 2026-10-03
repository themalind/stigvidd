<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# A best-effort mail is silently absent in the integration tests, so an assertion that it was not sent passes whatever the code does

The mail templates (`welcome`, `verify-email`, `reset-password`) reach production through
**migration `InsertData`**. The integration suite builds its schema with `EnsureCreated`, which
applies no migration, so **no template exists in the test database** unless the test class seeds
one itself, as
[`AccountControllerTests.SeedMailTemplates`](../../backend/Tests/IntegrationTests/AccountController/AccountControllerTests.cs)
does.

For a mail whose failure is fatal, this is loud. `verify-email` rolls registration back, so every
register goes red until the template is seeded. For a **best-effort** mail it is completely
silent. `MailOutboxService.EnqueueAsync` answers an unknown key with a failed `Result` (404),
[`WelcomeMailService.SendAsync`](../../backend/Core/Services/WelcomeMailService.cs) logs it and
returns, the endpoint answers exactly as it would have anyway, and **no `OutboxEmails` row is ever
written**. Measured when the welcome mail moved from registration to email verification: before
`welcome` was seeded, the welcome mail had been failing on every register in that suite, and
nothing said so.

## What that does to assertions

- **"Not sent" is vacuous.** `Count(e => e.TemplateKey == "welcome") == 0` holds whether or not
  the code sends it. The same goes for any `SingleOrDefault(e => e.ToAddress == …)` that was meant
  to say "this is the only mail". `Register_WhenValid_QueuesTheVerificationMail` meant that only
  after `welcome` was seeded.
- **"Sent once, here" needs a zero before it.** With the template seeded, "exactly one welcome
  row after verifying" **stayed green when the send was put back in `Register`**, because the one
  row came from registration. It was caught by planting that defect (skill `prove-it-bites`),
  and fixed by asserting 0 rows before the verify call as well as 1 after.

## The rule

A test about a best-effort mail seeds that mail's template first. Then prove each
direction by breaking it: remove the send and confirm the "is sent" test goes red, and send it
from the wrong place and confirm the "is not sent" test goes red.

Related: [[in-memory-queue-in-front-of-a-database-journal]] for the outbox itself,
[[integration-tests-inherit-api-config]] for another way this suite is green for the wrong reason.
