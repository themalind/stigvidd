// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { ChoiceCard } from "@/components/choice-card";
import { MunicipalitySelect } from "@/components/municipality-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddImportSource, useImportSources } from "@/features/facility-import/api/sources";

interface Props {
  municipalityIdentifier: string;
  sourceIdentifier: string;
  onMunicipality: (identifier: string) => void;
  onSource: (identifier: string) => void;
  onContinue: () => void;
}

// keep-comment: the card for a data source that does not exist yet
const NEW = "new";

function blocker(municipalityIdentifier: string, choice: string, name: string): string | null {
  if (!municipalityIdentifier) return "Choose a municipality to continue.";
  if (!choice) return "Choose a data source to continue.";
  if (choice === NEW && name.trim() === "") return "Give the new data source a name to continue.";
  return null;
}

export function SourceStep({ municipalityIdentifier, sourceIdentifier, onMunicipality, onSource, onContinue }: Props) {
  const sources = useImportSources();
  const add = useAddImportSource();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const own = (sources.data ?? []).filter((source) => source.municipalityIdentifier === municipalityIdentifier);
  const choice = adding ? NEW : sourceIdentifier;
  const problem = blocker(municipalityIdentifier, choice, name);

  async function handleContinue() {
    if (!adding) {
      onContinue();
      return;
    }

    let created;
    try {
      created = await add.mutateAsync({ municipalityIdentifier, name: name.trim() });
    } catch {
      // keep-comment: the mutation's toast says why; the name stays so it can be corrected
      return;
    }
    onSource(created.identifier);
    setAdding(false);
    setName("");
    onContinue();
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Where does the file come from?</h2>
        <p className="text-sm text-muted-foreground">
          A data source is one file a municipality publishes again and again, such as its list of bathing sites.
          Importing the next version of the same file updates the places it brought in last time instead of adding them
          twice.
        </p>
      </div>

      <div className="max-w-sm">
        <MunicipalitySelect
          value={municipalityIdentifier}
          disabled={add.isPending}
          onChange={(identifier) => {
            setAdding(false);
            onMunicipality(identifier);
          }}
        />
      </div>

      {municipalityIdentifier && (
        <div role="group" aria-label="Data source" className="space-y-2">
          <span className="text-sm font-medium">Data source</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {own.map((source) => (
              <ChoiceCard
                key={source.identifier}
                title={source.name}
                description={source.mapping ? "Imported before; its fields are remembered" : "Not imported yet"}
                selected={choice === source.identifier}
                disabled={add.isPending}
                onSelect={() => {
                  setAdding(false);
                  onSource(source.identifier);
                }}
              />
            ))}
            <ChoiceCard
              title="+ A new data source"
              description="The first time you import this file"
              selected={adding}
              disabled={add.isPending}
              onSelect={() => setAdding(true)}
            />
          </div>
        </div>
      )}

      {adding && (
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="new-source-name">Name it after what the file holds</Label>
          <Input
            id="new-source-name"
            value={name}
            placeholder="e.g. Badplatser"
            disabled={add.isPending}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">You pick this name again next time you get the same file.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={problem !== null || add.isPending} onClick={() => void handleContinue()}>
          {add.isPending && <Loader2 className="animate-spin" />}
          Continue
        </Button>
        {problem && <span className="text-xs text-muted-foreground">{problem}</span>}
      </div>
    </section>
  );
}
