<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Mail

How the API sends email: a **template store** and an **outbox**, both database tables, drained
by a background service that is triggered by an in-memory queue rather than a poll.

This is the API's own mail. Keycloak's password-reset mail is a separate path entirely —
Keycloak templates and sends it from realm configuration that is not in this repository
(see [DEPLOYMENT.md](../DEPLOYMENT.md), "Keycloak email settings").

Its first caller is **registration**: `verify-email` carries the link and code that stand
between signing up and being able to log in. See [auth](auth.md).

## Sending one

```csharp
await _mailOutbox.EnqueueAsync(
    "welcome",                                              // template key
    user.Email,
    new Dictionary<string, string?> { ["NickName"] = user.NickName },
    ctoken,
    toName: user.NickName);                                 // optional
```

`EnqueueAsync` returns the new row's `Identifier`, and returns **before** any SMTP happens —
a caller is never blocked on the mail server. It fails, with nothing written, when:

| | |
| --- | --- |
| the template key (or its language) is unknown | 404 |
| the model has no value for a placeholder the template uses | 400, naming the placeholder |
| the recipient address has no domain | 400 |

All three are caller bugs, and enqueue time is the last moment a caller is listening — which
is the reason the template is rendered here rather than at send time.

## The templating

Templates live in `MailTemplates`, unique on **(Key, Language)**, so wording can be corrected
by an operator without a deploy. A template carries a `Subject`, a `BodyHtml` and a `BodyText`;
the text part is not optional, because a mail with no text alternative is both unreadable in a
plain-text client and a spam-score penalty everywhere else.

Substitution is `{{Placeholder}}` and nothing else — no conditionals, no loops, no partials. A
template that wants a decision made in it is a sign the decision belongs in C# at the call
site, where it can be tested.

- Inner whitespace is allowed: `{{ NickName }}` and `{{NickName}}` are the same placeholder.
- Model keys are matched case-insensitively.
- A placeholder the model has **no key for** fails the render. Mailing somebody the literal
  text `Hej {{NickName}}` is worse than not mailing them.
- A key present with a `null` value renders as empty — that is the caller saying "no value",
  which is a different thing from forgetting the key exists.
- Values are **HTML-encoded into the HTML body only**. The subject and text body get the raw
  value. A nickname containing `<` would otherwise break the markup, or inject into it.
- CR and LF are stripped from the rendered **subject**: a newline there lets everything after
  it be read as a new SMTP header.

`language` defaults to `MailOutbox:DefaultLanguage` (`sv`). If a key exists but not in the
language asked for, the default language is used; only if that misses too is it a 404.

## The outbox, and why it is shaped this way

`OutboxEmails` is the queue. The in-memory `Channel<int>` is only a hint that says "look at row
N now rather than later", which is what gets a mail out in milliseconds instead of on a poll
tick. Correctness rests entirely on the table, through three rules:

1. **Write, then signal.** The row is committed before its id reaches the channel, so the
   dispatcher can never be handed an id it cannot read.
2. **Every boot re-signals the journal.** `MailOutboxDispatcher` first moves rows left in
   `Sending` back to `Pending` (a restart orphaned them — the queue died with the process),
   then pushes *every* `Pending` id into the channel. Interrupted, never signalled, or half
   way through a backoff: all of it gets another chance.
3. **A signal is a hint, not a claim.** Claiming is a `Pending` → `Sending` transition in the
   database. A duplicate signal finds the row is not `Pending` and does nothing, so the same
   mail is never sent twice.

A lost signal therefore costs latency and never a mail.

```
Pending ──claim──> Sending ──sent────> Sent
   ^                  │
   └──failed, under ──┘
      the attempt cap        ──permanent, or cap reached──> Failed
```

Retries are **scheduled, not polled**: a transient failure puts the row back to `Pending` with
`NextAttemptAt` set, and the dispatcher starts a `Task.Delay` that re-signals the id when the
backoff expires. That timer is best-effort by design — if the process dies before it fires,
rule 2 recovers the row on the next start.

Backoff is 1, 2, 4, 8, 16 minutes, capped, up to `MailOutbox:MaxAttempts` (default 5) before
the row is parked as `Failed` with `LastError` kept. A **5xx** SMTP reply skips straight to
`Failed`: the server has said the message itself is unacceptable, so four more attempts buy
the same answer more slowly. Connection errors and 4xx replies retry — greylisting, which
Rspamd has enabled on this mail server, is specifically designed to be retried.

**This assumes a single API instance.** Claiming is a read-then-update, not `SELECT … FOR
UPDATE SKIP LOCKED`, and the channel is per-process — the same assumption
`TrailImportAnalysisWorker` documents.

## Configuration

Two sections, split by who owns them.

`Smtp:*` is the transport, and is set by [docker-compose.yml](../docker-compose.yml) on the
`api` service from `MAIL_DOMAIN` / `SMTP_NOREPLY_USER` / `SMTP_NOREPLY_PASSWORD`:

| key | |
| --- | --- |
| `Smtp:Host` | the mail server. Its docker network alias, so STARTTLS matches its certificate |
| `Smtp:Port` | 587 |
| `Smtp:User` / `Smtp:Password` | the submission mailbox. Authentication is skipped when `User` is empty |
| `Smtp:From` | envelope and header sender |

**`Smtp` is deliberately absent from `appsettings.json`.** Its absence is what registers
`LoggingMailSender` instead of `SmtpMailSender` — so local development, the test suite and a
partial stack that runs no mail server log the mail at warning level and drain the outbox
rather than accumulating rows that were never going to be sent. Adding an empty `Smtp` block
would defeat that. The API must never fail to start over mail, so there is no fail-fast here.

`MailOutbox:*` is in `appsettings.json`: `MaxAttempts` (5) and `DefaultLanguage` (`sv`).

## Adding a template

Templates are rows, so a new one is an `INSERT` — by hand on the host, or as a
`migrationBuilder.InsertData` in a new migration. **Not `modelBuilder.HasData`**: that makes
the rows part of the EF model, and a later migration would then revert an operator's edit to
the wording, which is the whole reason the copy lives in the database. See
[docs/notes/mail-templates-seeded-with-insertdata.md](notes/mail-templates-seeded-with-insertdata.md).

`20260912103250_AddMailOutbox` seeds `welcome`/`sv` that way as a worked example, and
`20260912125829_AddEmailVerification` seeds `verify-email`/`sv` the same way. The latter takes
three placeholders — `{{NickName}}`, `{{VerificationUrl}}` and `{{VerificationCode}}`.

No test applies a migration, so a test needing a template seeds its own — see
`Tests/IntegrationTests/Mail/MailOutboxIntegrationTests.cs`.

## Editing the wording

Editing copy is what the table exists for, and it is done in the **web admin** — *Mail
Templates* in the sidebar — rather than by hand on the host. `Key` and `Language` are not
editable there: they are what the calling code passes to `EnqueueAsync`, so changing either
orphans the call site.

### The two ways to break a mail are not symmetric

This is the whole basis of the editor, and both halves are measured in
`Tests/UnitTests/ServiceTests/MailTemplateRendererTests.cs`:

| the edit | what happens | what the editor does |
| --- | --- | --- |
| **adds** a placeholder the caller does not supply (`{{NickNmae}}`) | `Render` fails 400, `EnqueueAsync` fails with it, and **the mail is never sent** | refuses the save, naming the placeholder |
| **drops** a placeholder the caller does supply | renders fine — a model key the template does not use is ignored — but the recipient gets a verification mail with no link in it | allows it, and says what the mail will no longer contain |

Only the first stops mail. The second is a judgement for the operator, so it is a warning and
not a refusal.

### Which placeholders a template may use

That set used to exist only as prose in the `Description` column, which nothing validated.
It is now declared in [`Core/Services/MailTemplateCatalog.cs`](../backend/Core/Services/MailTemplateCatalog.cs)
— a label, a description and a sample value per placeholder, per template key — and the editor
shows it beside the copy.

A catalogue that can drift from the call site would be no better than the prose it replaced,
so `MailTemplateCatalogTests` drives the real caller, captures the model dictionary it passes,
and asserts the two agree. **Adding a placeholder to a mail means adding it in both places**,
or that test fails.

A key the catalogue does not describe is not an error: nothing in C# sends it, so nothing can
be said about what its caller supplies, and the editor reports rather than condemns it.

### Preview

`POST /api/v1/admin/mail-templates/{identifier}/preview` renders an **unsaved** draft through
`IMailTemplateRenderer` with the catalogue's sample values — the same code path a real send
takes. So a draft that would fail at enqueue fails in the editor first, with the same message,
before it is saved. It writes nothing.

### What the visual editor can and cannot keep

The editor is TipTap over a deliberately small schema. Inline styles, link attributes and
table attributes are carried through verbatim, because mail is styled inline and a schema that
dropped them would turn the verification button into a plain link.

Anything the schema cannot represent — `<table>` layouts, most of all — is **detected rather
than silently rewritten**: the body is put through the schema headlessly on load, compared for
what was dropped, and a template that would lose something opens in an HTML source view with a
banner saying what. Two things change without being losses, and both are deliberate: the
newlines between stored `<p>` blocks do not survive, and style *values* are re-serialised by
the CSSOM (`#3f6b43` becomes `rgb(63, 107, 67)`).

Nothing is written unless the operator actually edits something — dirtiness comes from edit
events, never from comparing strings, precisely because the comparison would be true the
moment the page opened. See
[docs/notes/wysiwyg-over-operator-authored-html.md](notes/wysiwyg-over-operator-authored-html.md).

## Where the code is

| | |
| --- | --- |
| `Core/Services/MailOutboxService.cs` | the enqueue API: validate, render, journal, signal |
| `Core/Services/MailTemplateRenderer.cs` | `{{Placeholder}}` substitution and the encoding rules |
| `Core/Services/MailTemplateCatalog.cs` | which placeholders each template key may use |
| `Core/Services/MailTemplateAdminService.cs` | the editor's read/update/preview, and the unknown-placeholder refusal |
| `Core/Services/MailHtmlPolicy.cs` | the email-safe markup allowlist a save is checked against |
| `StigviddAPI/Controllers/MailTemplatesController.cs` | `api/v1/admin/mail-templates`, admin-only |
| `web/src/lib/mail-template.ts` | the editor's pure rules: the token grammar, the HTML scanner, loss detection |
| `Core/Services/MailOutboxQueue.cs` | the `Channel<int>` trigger |
| `Core/Services/SmtpMailSender.cs` | MailKit; STARTTLS on 587 |
| `Core/Services/LoggingMailSender.cs` | the no-op used when `Smtp:Host` is absent |
| `Core/Repositories/MailOutboxRepository.cs` | claim, mark, release, recover, and the backoff |
| `StigviddAPI/BackgroundServices/MailOutboxDispatcher.cs` | the drain loop and the startup sweep |

Related: [observability](observability.md) for where the logs go,
[push-notifications](push-notifications.md) for the other notification channel.
