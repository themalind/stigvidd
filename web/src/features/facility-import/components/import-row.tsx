// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AlertTriangle } from "lucide-react";
import type {
  FacilityImportCandidateResponse,
  FacilityImportField,
  FacilityImportRowKind,
} from "@/api/generated/model";
import { CheckboxField } from "@/components/form-field";
import { ToneBadge, type Tone } from "@/components/tone-badge";
import { cn } from "@/lib/utils";
import type { ImportRow as Row } from "@/features/facility-import/api/facility-import";
import {
  changeText,
  CREATE_NEW,
  fieldLabel,
  isLink,
  kindLabel,
} from "@/features/facility-import/utils/facility-import";
import { facilityTypeLabel } from "@/utils/facility-types";

const kindTone: Record<FacilityImportRowKind, Tone> = {
  New: "created",
  Changed: "warn",
  Missing: "bad",
  Unchanged: "muted",
};

interface Props {
  row: Row;
  candidates: readonly FacilityImportCandidateResponse[];
  taken: ReadonlySet<string>;
  disabled: boolean;
  onChoose: (choice: string) => void;
  onKeep: (field: FacilityImportField, keep: boolean) => void;
}

export function ImportRow({ row, candidates, taken, disabled, onChoose, onKeep }: Props) {
  const selectId = `link-${row.sourceId}`;
  const linking = isLink(row);
  // keep-comment: only a value we hold can be kept; a created row holds none
  const keepable = (current: string | null | undefined) => Boolean(row.facilityIdentifier) && current != null;
  const sameType = candidates.filter((candidate) => (candidate.facilityType & row.facilityType) !== 0);

  return (
    <li className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{row.name}</span>
        {linking ? (
          <ToneBadge tone="okSoft">Link</ToneBadge>
        ) : (
          <ToneBadge tone={kindTone[row.kind]}>{kindLabel[row.kind]}</ToneBadge>
        )}
        <span className="text-xs text-muted-foreground">{facilityTypeLabel(row.facilityType)}</span>
        {row.facilityName && row.facilityName !== row.name && (
          <span className="text-xs text-muted-foreground">ours: {row.facilityName}</span>
        )}
      </div>

      {row.kind === "New" && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="text-xs text-muted-foreground">
            Import as
          </label>
          <select
            id={selectId}
            className="h-8 min-w-64 rounded-sm border bg-background px-2 text-sm"
            value={row.facilityIdentifier ?? CREATE_NEW}
            disabled={disabled}
            onChange={(e) => onChoose(e.target.value)}
          >
            <option value={CREATE_NEW}>A new facility</option>
            {sameType.map((candidate) => (
              <option
                key={candidate.identifier}
                value={candidate.identifier}
                disabled={taken.has(candidate.identifier)}
              >
                Link to {candidate.name}
                {candidate.identifier === row.suggestedFacilityIdentifier ? " (suggested)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {row.kind === "Missing" && (
        <p className="text-xs text-muted-foreground">
          The source no longer lists it. Nothing is removed; delete it by hand if it is gone.
        </p>
      )}

      {row.changes.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
          {row.changes.map((change) => (
            <div key={change.field} className="contents">
              <dt className="text-muted-foreground">{fieldLabel[change.field]}</dt>
              <dd className="min-w-0 space-y-1 break-words">
                <div>
                  {change.current !== null && (
                    <>
                      <span className={change.kept ? "" : "text-muted-foreground line-through"}>
                        {changeText(change.field, change.current)}
                      </span>{" "}
                    </>
                  )}
                  <span className={change.kept ? "text-muted-foreground line-through" : ""}>
                    {change.incoming === null ? "(empty)" : changeText(change.field, change.incoming)}
                  </span>
                  {change.overwritesLocalEdit && (
                    // keep-comment: hidden rather than removed, so keeping a field does not reflow the text
                    <span
                      className={cn("ml-2 inline-flex items-center gap-1 text-amber-600", change.kept && "invisible")}
                      aria-hidden={change.kept}
                    >
                      <AlertTriangle className="size-3" />
                      {linking ? "replaces our text" : "replaces your edit"}
                    </span>
                  )}
                </div>
                {keepable(change.current) && (
                  <CheckboxField
                    label={`Keep our ${fieldLabel[change.field].toLowerCase()}`}
                    checked={change.kept}
                    disabled={disabled}
                    onChange={(keep) => onKeep(change.field, keep)}
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
