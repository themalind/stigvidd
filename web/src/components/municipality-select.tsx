// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useAddMunicipality, useMunicipalities } from "@/api/municipalities";
import { PickOrAdd } from "@/components/pick-or-add";

interface Props {
  value: string;
  disabled: boolean;
  // keep-comment: given, "" means no municipality and the choice is saved as soon as it changes
  noneLabel?: string;
  onChange: (identifier: string) => void;
}

export function MunicipalitySelect({ value, disabled, noneLabel, onChange }: Props) {
  const municipalities = useMunicipalities();
  const add = useAddMunicipality();

  return (
    <PickOrAdd
      label="Municipality"
      value={value}
      options={(municipalities.data ?? []).map((m) => ({ value: m.identifier, label: m.name }))}
      placeholder={noneLabel ?? "Choose a municipality"}
      addLabel="Add a municipality…"
      newLabel="New municipality"
      addPlaceholder="Ulricehamn"
      disabled={disabled || municipalities.isPending}
      clearWhileAdding={noneLabel === undefined}
      onChange={onChange}
      onAdd={async (name) => (await add.mutateAsync({ name })).identifier}
    />
  );
}
