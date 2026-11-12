// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SelectField, type SelectOption } from "@/components/form-field";
import { EMPTY_VALUE, type FileField, type FileSummary } from "@/features/facility-import/utils/inspect";
import {
  guessTypeValues,
  LEAVE_OUT,
  NO_FIELD,
  valuesOf,
  type MappingDraft,
} from "@/features/facility-import/utils/mapping";
import { FACILITY_TYPES } from "@/utils/facility-types";

interface Props {
  summary: FileSummary;
  draft: MappingDraft;
  remembered: boolean;
  disabled: boolean;
  onChange: (draft: MappingDraft) => void;
}

function fieldOption(field: FileField): SelectOption {
  const samples = field.samples.map((sample) => (sample.length > 30 ? `${sample.slice(0, 30)}…` : sample));
  return { value: field.name, label: samples.length > 0 ? `${field.name} (${samples.join(", ")})` : field.name };
}

const TYPE_OPTIONS: SelectOption[] = FACILITY_TYPES.map(([bit, label]) => ({ value: String(bit), label }));

export function MappingForm({ summary, draft, remembered, disabled, onChange }: Props) {
  const fields = summary.fields.map(fieldOption);
  const typeFields = summary.fields.filter((field) => field.values !== null).map(fieldOption);
  const none = (label: string): SelectOption[] => [{ value: NO_FIELD, label }, ...fields];
  // keep-comment: a saved id the file lacks stays listed, so the select shows it and the form says what is wrong
  const idOptions =
    draft.idField === NO_FIELD || fields.some((field) => field.value === draft.idField)
      ? none("None – match on position")
      : [...none("None – match on position"), { value: draft.idField, label: `${draft.idField} (not in this file)` }];

  function set(patch: Partial<MappingDraft>) {
    onChange({ ...draft, ...patch });
  }

  function setTypeField(typeField: string) {
    set({ typeField, typeValues: guessTypeValues(valuesOf(summary, typeField), draft.typeValues) });
  }

  return (
    <fieldset className="space-y-4 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">Fields</legend>
      <p className="text-xs text-muted-foreground">
        {summary.points} {summary.points === 1 ? "point" : "points"} in the file.{" "}
        {remembered
          ? "The data source's fields from last time are chosen."
          : "Common field names are guessed; check them."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Name"
          value={draft.nameField}
          options={none("Choose a field")}
          disabled={disabled}
          onChange={(nameField) => set({ nameField })}
        />
        <SelectField
          label="Id"
          value={draft.idField}
          options={idOptions}
          disabled={disabled || remembered}
          hint={
            remembered
              ? "Set by the first import. Another id would make every facility new."
              : "An id that stays the same between exports. Without one, a point within 25 m of the last import is the same facility."
          }
          onChange={(idField) => set({ idField })}
        />
        <SelectField
          label="Description"
          value={draft.descriptionField}
          options={none("None")}
          disabled={disabled}
          onChange={(descriptionField) => set({ descriptionField })}
        />
        <SelectField
          label="Link"
          value={draft.urlField}
          options={none("None")}
          disabled={disabled}
          onChange={(urlField) => set({ urlField })}
        />
      </div>

      <SelectField
        label="Facility type from"
        value={draft.typeField}
        options={[{ value: NO_FIELD, label: "One type for the whole file" }, ...typeFields]}
        disabled={disabled}
        onChange={setTypeField}
      />

      {draft.typeField === NO_FIELD ? (
        <SelectField
          label="Facility type"
          value={String(draft.fixedType)}
          options={[{ value: String(LEAVE_OUT), label: "Choose a type" }, ...TYPE_OPTIONS]}
          disabled={disabled}
          onChange={(value) => set({ fixedType: Number(value) })}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Each value in {draft.typeField} becomes a facility type. Points with a value left out are not imported.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(draft.typeValues).map(([value, type]) => (
              <SelectField
                key={value}
                label={value === EMPTY_VALUE ? "(no value)" : value}
                value={String(type)}
                options={[{ value: String(LEAVE_OUT), label: "Leave out" }, ...TYPE_OPTIONS]}
                disabled={disabled}
                onChange={(next) => set({ typeValues: { ...draft.typeValues, [value]: Number(next) } })}
              />
            ))}
          </div>
        </div>
      )}
    </fieldset>
  );
}
