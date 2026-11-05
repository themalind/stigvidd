// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { Preview, Proposal } from "@/features/trail-import/api/trail-import";
import { km } from "@/features/trail-import/utils/proposal-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type LengthChoice = "measured" | "source";

interface Props {
  proposal: Proposal;
  preview: Preview | undefined;
  saving: boolean;
  onCreate: (trail: { name: string; lengthKm: number | undefined }) => void;
  onCancel: () => void;
}

export function NewTrailPanel({ proposal, preview, saving, onCreate, onCancel }: Props) {
  const [name, setName] = useState(proposal.decidedName ?? proposal.featureName);
  const [lengthChoice, setLengthChoice] = useState<LengthChoice>("measured");
  // keep-comment: a created trail is stored with the source's line, so the measured length is the one that matches it
  const lengthKm = lengthChoice === "source" ? (preview?.sourceStatedLengthKm ?? undefined) : preview?.featureLengthKm;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-2">
        <Label htmlFor="new-name">Name for the new trail</Label>
        <Input id="new-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        <p className="text-xs text-muted-foreground">
          The source calls it "{proposal.featureName || "(no name)"}". This is the only place the import writes a name,
          so what stands here is what the trail is called.
        </p>
      </div>

      {preview?.sourceStatedLengthKm != null && preview.sourceLengthDisagrees ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Length</p>
          <RadioGroup value={lengthChoice} onValueChange={(value) => setLengthChoice(value as LengthChoice)}>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value="measured" className="mt-0.5" disabled={saving} />
              <span>
                <span className="text-sm font-medium">{km(preview.featureLengthKm)}, measured from the line</span>
                <span className="block text-xs text-muted-foreground">
                  Matches the geometry the trail is stored with.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value="source" className="mt-0.5" disabled={saving} />
              <span>
                <span className="text-sm font-medium">{km(preview.sourceStatedLengthKm)}, what the source states</span>
                <span className="block text-xs text-muted-foreground">
                  Pick this when the line is the broken one, such as a loop drawn half way.
                </span>
              </span>
            </label>
          </RadioGroup>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Length {km(preview?.featureLengthKm)}, measured from the line.</p>
      )}

      <div className="flex gap-2">
        <Button onClick={() => onCreate({ name: name.trim(), lengthKm })} disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Create trail
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
