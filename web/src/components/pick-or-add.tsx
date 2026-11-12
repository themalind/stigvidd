// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { SelectField, type SelectOption } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ADD = "__add";

interface Props {
  label: string;
  value: string;
  options: readonly SelectOption[];
  placeholder: string;
  addLabel: string;
  newLabel: string;
  addPlaceholder: string;
  disabled: boolean;
  hint?: ReactNode;
  // keep-comment: false keeps the current value while a new item is typed, for a select that saves on change
  clearWhileAdding?: boolean;
  onChange: (value: string) => void;
  // keep-comment: resolves to the new item's value; a rejection keeps the name so it can be corrected
  onAdd: (name: string) => Promise<string>;
}

export function PickOrAdd({
  label,
  value,
  options,
  placeholder,
  addLabel,
  newLabel,
  addPlaceholder,
  disabled,
  hint,
  clearWhileAdding = true,
  onChange,
  onAdd,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [previous, setPrevious] = useState(value);

  async function handleAdd() {
    setSaving(true);
    try {
      onChange(await onAdd(name.trim()));
      setAdding(false);
      setName("");
    } catch {
      // keep-comment: the mutation's toast says why
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <SelectField
        label={label}
        value={adding ? ADD : value}
        options={[{ value: "", label: placeholder }, ...options, { value: ADD, label: addLabel }]}
        disabled={disabled}
        hint={hint}
        onChange={(next) => {
          if (next === ADD && !adding) setPrevious(value);
          setAdding(next === ADD);
          if (next !== ADD) onChange(next);
          else if (clearWhileAdding) onChange("");
        }}
      />

      {adding && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={newLabel}
            className="w-64"
            value={name}
            placeholder={addPlaceholder}
            autoFocus
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
          />
          <Button size="sm" disabled={name.trim() === "" || saving} onClick={() => void handleAdd()}>
            {saving && <Loader2 className="animate-spin" />}
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setAdding(false);
              setName("");
              if (clearWhileAdding) onChange(previous);
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
