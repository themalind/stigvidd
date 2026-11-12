// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useId, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  length?: number;
  max?: number;
  children: (id: string) => ReactNode;
}

// keep-comment: hands the control the id its label points at, so the label names it and clicking the label focuses it
export function FormField({ label, length, max, children }: FormFieldProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {max !== undefined && (
          <span className={cn("text-xs", length === max ? "text-destructive" : "text-muted-foreground")}>
            {length ?? 0}/{max}
          </span>
        )}
      </div>
      {children(id)}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
}

export function TextField({ label, value, onChange, max, multiline = false }: TextFieldProps) {
  return (
    <FormField label={label} length={value.length} max={max}>
      {(id) =>
        multiline ? (
          <Textarea id={id} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <Input id={id} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
        )
      }
    </FormField>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: ReactNode;
}

export function SelectField({ label, value, options, onChange, disabled, hint }: SelectFieldProps) {
  return (
    <FormField label={label}>
      {(id) => (
        <>
          <select
            id={id}
            className="h-9 w-full min-w-64 rounded-sm border bg-background px-2 text-sm sm:w-auto"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </>
      )}
    </FormField>
  );
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function CheckboxField({ label, checked, onChange, disabled }: CheckboxFieldProps) {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(state) => onChange(state === true)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
