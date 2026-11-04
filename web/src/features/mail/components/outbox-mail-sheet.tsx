// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Eye, Loader2 } from "lucide-react";
import type { OutboxEmailSummaryResponse } from "@/api/generated/model";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  outboxMailQueryOptions,
  useCancelOutboxMail,
  useOutboxMailBody,
  useRetryOutboxMail,
} from "@/features/mail/api/mail-outbox";
import { canCancel, canRetry, canRevealBody, describeRedaction } from "@/features/mail/utils/mail-outbox";
import { formatDateTime } from "@/utils/format";
import MailPreview from "./mail-preview";
import { OutboxStatusBadge } from "./outbox-status-badge";

interface Props {
  identifier: string | null;
  onClose: () => void;
}

export function OutboxMailSheet({ identifier, onClose }: Props) {
  return (
    <Sheet open={identifier !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {identifier && (
          <QueryBoundary>
            <OutboxMail key={identifier} identifier={identifier} onDone={onClose} />
          </QueryBoundary>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OutboxMail({ identifier, onDone }: { identifier: string; onDone: () => void }) {
  const { data } = useSuspenseQuery(outboxMailQueryOptions(identifier));
  const mail = data.email;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <OutboxStatusBadge status={mail.status} />
          <span className="truncate">{mail.subject}</span>
        </SheetTitle>
        <SheetDescription asChild>
          <div className="space-y-1 text-left">
            <div>
              To {mail.toAddress}
              {mail.toName ? ` (${mail.toName})` : ""}
            </div>
            <div>
              Queued {formatDateTime(mail.createdAt)} · {mail.attempts} attempt
              {mail.attempts === 1 ? "" : "s"}
              {mail.sentAt ? ` · sent ${formatDateTime(mail.sentAt)}` : ""}
            </div>
            {mail.lastError && <div className="text-destructive">{mail.lastError}</div>}
          </div>
        </SheetDescription>
      </SheetHeader>

      <div className="px-4">
        {canRevealBody(mail) ? (
          <MailBody mail={mail} />
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="body-redacted">
            {describeRedaction(mail)}
          </p>
        )}
      </div>

      <SheetFooter>
        <MailActions mail={mail} onDone={onDone} />
      </SheetFooter>
    </>
  );
}

function MailBody({ mail }: { mail: OutboxEmailSummaryResponse }) {
  const [revealed, setRevealed] = useState(false);
  const body = useOutboxMailBody(mail.identifier, revealed);

  if (body.data) {
    // keep-comment: the template editor's sandboxed renderer; a body is operator-authored markup
    return (
      <MailPreview preview={{ subject: mail.subject, bodyHtml: body.data.bodyHtml, bodyText: body.data.bodyText }} />
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={body.isFetching}
        onClick={() => (revealed ? void body.refetch() : setRevealed(true))}
        data-testid="reveal-body"
      >
        {body.isFetching ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
        Show the mail body
      </Button>
      {body.isError && (
        <p className="text-sm text-destructive">
          {body.error instanceof Error ? body.error.message : "The body could not be read."}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        The body is not loaded with the mail. It contains the recipient&apos;s name and, for a password reset, a working
        link — so opening it is recorded.
      </p>
    </div>
  );
}

function MailActions({ mail, onDone }: { mail: OutboxEmailSummaryResponse; onDone: () => void }) {
  const retry = useRetryOutboxMail();
  const cancel = useCancelOutboxMail();
  const busy = retry.isPending || cancel.isPending;

  if (canRetry(mail)) {
    return (
      <Button disabled={busy} onClick={() => retry.mutate(mail.identifier, { onSuccess: onDone })} data-testid="retry">
        {busy && <Loader2 className="size-4 animate-spin" />}
        Retry now
      </Button>
    );
  }

  if (canCancel(mail)) {
    return (
      <Button
        variant="destructive"
        disabled={busy}
        onClick={() => cancel.mutate(mail.identifier, { onSuccess: onDone })}
        data-testid="cancel"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Cancel this mail
      </Button>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      {mail.status === "Sending"
        ? "This mail is being sent right now, so it can be neither retried nor cancelled."
        : mail.status === "Sent"
          ? "Nothing to do — this mail has already been sent."
          : "Nothing to do — this mail can no longer be sent, because its rendered body has been cleared under the retention policy."}
    </p>
  );
}
