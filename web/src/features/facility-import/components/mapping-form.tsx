// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ChoiceCard } from "@/components/choice-card";
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
  const noId = "None, recognise places by position";
  // keep-comment: a saved id the file lacks stays listed, so the select shows it and the form says what is wrong
  const idOptions =
    draft.idField === NO_FIELD || fields.some((field) => field.value === draft.idField)
      ? none(noId)
      : [...none(noId), { value: draft.idField, label: `${draft.idField} (not in this file)` }];
  const oneType = draft.typeField === NO_FIELD;

  function set(patch: Partial<MappingDraft>) {
    onChange({ ...draft, ...patch });
  }

  function setTypeField(typeField: string) {
    set({ typeField, typeValues: guessTypeValues(valuesOf(summary, typeField), draft.typeValues) });
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        {remembered
          ? "The columns this data source used last time are chosen."
          : "We guessed from the column names; check them."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Which column is the name?"
          value={draft.nameField}
          options={none("Choose a column")}
          disabled={disabled}
          onChange={(nameField) => set({ nameField })}
        />
        <SelectField
          label="Which column is the place's own id?"
          value={draft.idField}
          options={idOptions}
          disabled={disabled || remembered}
          hint={
            remembered
              ? "Set by the first import. Another id would make every place new."
              : "Kept as the facility's SourceId. It must stay the same in the next export: that is how the next file finds the same place. Without one, a point within 25 m of the last import is the same place."
          }
          onChange={(idField) => set({ idField })}
        />
        <SelectField
          label="Description (optional)"
          value={draft.descriptionField}
          options={none("None")}
          disabled={disabled}
          onChange={(descriptionField) => set({ descriptionField })}
        />
        <SelectField
          label="Link (optional)"
          value={draft.urlField}
          options={none("None")}
          disabled={disabled}
          onChange={(urlField) => set({ urlField })}
        />
      </div>

      <div role="group" aria-label="What kind of places are these?" className="space-y-2">
        <span className="text-sm font-medium">What kind of places are these?</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard
            title="All are the same kind"
            description="For example a file of only bathing sites"
            selected={oneType}
            disabled={disabled}
            onSelect={() => set({ typeField: NO_FIELD })}
          />
          <ChoiceCard
            title="The kind is in a column"
            description={
              typeFields.length > 0
                ? 'For example "Grillplats" or "Vindskydd" on each row'
                : "No column in this file has few enough values"
            }
            selected={!oneType}
            disabled={disabled || typeFields.length === 0}
            onSelect={() => {
              if (oneType && typeFields[0]) setTypeField(typeFields[0].value);
            }}
          />
        </div>

        {oneType ? (
          <div className="max-w-sm">
            <SelectField
              label="Every place in the file becomes"
              value={String(draft.fixedType)}
              options={[{ value: String(LEAVE_OUT), label: "Choose a type" }, ...TYPE_OPTIONS]}
              disabled={disabled}
              onChange={(value) => set({ fixedType: Number(value) })}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="max-w-sm">
              <SelectField
                label="Column with the kind"
                value={draft.typeField}
                options={typeFields}
                disabled={disabled}
                onChange={setTypeField}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Each value becomes a facility type. Places with a value left out are not imported.
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
      </div>
    </div>
  );
}
