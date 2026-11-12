// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PickOrAdd } from "@/components/pick-or-add";
import { useAddImportSource, useImportSources } from "@/features/facility-import/api/sources";

interface Props {
  municipalityIdentifier: string;
  value: string;
  disabled: boolean;
  onChange: (identifier: string) => void;
}

export function SourceSelect({ municipalityIdentifier, value, disabled, onChange }: Props) {
  const sources = useImportSources();
  const add = useAddImportSource();
  const own = (sources.data ?? []).filter((source) => source.municipalityIdentifier === municipalityIdentifier);

  return (
    <PickOrAdd
      label="Data source"
      value={value}
      options={own.map((source) => ({ value: source.identifier, label: source.name }))}
      placeholder={municipalityIdentifier ? "Choose a data source" : "Choose a municipality first"}
      addLabel="Add a data source…"
      newLabel="New data source"
      addPlaceholder="Grillplatser och vindskydd"
      disabled={disabled || !municipalityIdentifier || sources.isPending}
      hint="An import only compares against what earlier files from the same data source brought in."
      onChange={onChange}
      onAdd={async (name) => (await add.mutateAsync({ municipalityIdentifier, name })).identifier}
    />
  );
}
