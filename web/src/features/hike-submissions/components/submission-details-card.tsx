// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminHikeSubmissionResponse, UpdateHikeSubmissionRequest } from "@/api/generated/model";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CLASSIFICATIONS = [
  { value: 1, label: "Easy" },
  { value: 2, label: "Medium" },
  { value: 3, label: "Hard" },
];

export type SubmissionFields = Pick<
  AdminHikeSubmissionResponse,
  | "name"
  | "description"
  | "classification"
  | "gettingThere"
  | "parking"
  | "publicTransport"
  | "accessibilityInfo"
  | "city"
>;

export function fieldsOf(detail: AdminHikeSubmissionResponse): SubmissionFields {
  const { name, description, classification, gettingThere, parking, publicTransport, accessibilityInfo, city } = detail;
  return { name, description, classification, gettingThere, parking, publicTransport, accessibilityInfo, city };
}

export function sameFields(a: SubmissionFields, b: SubmissionFields): boolean {
  return (Object.keys(a) as (keyof SubmissionFields)[]).every((key) => a[key] === b[key]);
}

// keep-comment: lastUpdatedAt is the version the edit started from, so a newer save elsewhere is refused
export function toUpdateRequest(fields: SubmissionFields, lastUpdatedAt: string): UpdateHikeSubmissionRequest {
  return {
    ...fields,
    parking: fields.parking || null,
    publicTransport: fields.publicTransport || null,
    accessibilityInfo: fields.accessibilityInfo || null,
    lastUpdatedAt,
  };
}

interface Props {
  fields: SubmissionFields;
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  onChange: (fields: SubmissionFields) => void;
  onSave: () => void;
}

export function SubmissionDetailsCard({ fields, editable, dirty, saving, onChange, onSave }: Props) {
  const set =
    <K extends keyof SubmissionFields>(key: K) =>
    (value: SubmissionFields[K]) =>
      onChange({ ...fields, [key]: value });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FieldInput label="Name" value={fields.name} disabled={!editable} onChange={set("name")} />
        <FieldInput label="City" value={fields.city} disabled={!editable} onChange={set("city")} />
        <div className="space-y-1">
          <Label htmlFor="review-description">Description</Label>
          <Textarea
            id="review-description"
            value={fields.description}
            disabled={!editable}
            onChange={(e) => set("description")(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="review-classification">Difficulty</Label>
          <select
            id="review-classification"
            className="h-9 w-full rounded-sm border bg-background px-2 text-sm"
            value={fields.classification}
            disabled={!editable}
            onChange={(e) => set("classification")(Number(e.target.value))}
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <FieldInput
          label="Getting there"
          value={fields.gettingThere}
          disabled={!editable}
          onChange={set("gettingThere")}
        />
        <FieldInput label="Parking" value={fields.parking} disabled={!editable} onChange={set("parking")} />
        <FieldInput
          label="Public transport"
          value={fields.publicTransport}
          disabled={!editable}
          onChange={set("publicTransport")}
        />
        <FieldInput
          label="Variation"
          value={fields.accessibilityInfo}
          disabled={!editable}
          onChange={set("accessibilityInfo")}
        />
        {editable && (
          <Button className="w-full" variant="outline" disabled={!dirty || saving} onClick={onSave}>
            Save details
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function FieldInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = `review-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
