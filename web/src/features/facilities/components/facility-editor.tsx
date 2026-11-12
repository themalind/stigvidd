// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { AdminFacilityResponse, SaveFacilityRequest } from "@/api/generated/model";
import { CheckboxField, FormField, TextField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSaveFacility } from "@/features/facilities/api/facility";
import { FACILITY_TYPES } from "@/utils/facility-types";
import { isHttpUrl } from "@/utils/url";

// keep-comment: mirrors SaveFacilityRequestValidator; over one, the API rejects the whole save with a 400
export const FACILITY_LIMITS = { name: 100, location: 200, description: 2000, url: 500 } as const;

interface FacilityForm {
  name: string;
  facilityType: number;
  isAccessible: boolean;
  latitude: string;
  longitude: string;
  location: string;
  description: string;
  url: string;
}

function toForm(facility: AdminFacilityResponse): FacilityForm {
  return {
    name: facility.name,
    facilityType: facility.facilityType,
    isAccessible: facility.isAccessible,
    latitude: facility.latitude === null ? "" : String(facility.latitude),
    longitude: facility.longitude === null ? "" : String(facility.longitude),
    location: facility.location,
    description: facility.description,
    url: facility.url,
  };
}

function coordinate(value: string, limit: number): number | null | undefined {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : undefined;
}

export function facilityProblem(form: FacilityForm): string | null {
  if (form.name.trim() === "") return "Give the facility a name.";
  if (form.facilityType === 0) return "Choose at least one type.";
  const latitude = coordinate(form.latitude, 90);
  const longitude = coordinate(form.longitude, 180);
  if (latitude === undefined) return "Latitude must be a number between -90 and 90.";
  if (longitude === undefined) return "Longitude must be a number between -180 and 180.";
  if ((latitude === null) !== (longitude === null)) return "Fill in both latitude and longitude, or neither.";
  if (form.url.trim() !== "" && !isHttpUrl(form.url)) return "Enter a full address starting with https://";
  return null;
}

function toRequest(form: FacilityForm): SaveFacilityRequest {
  return {
    name: form.name.trim(),
    facilityType: form.facilityType,
    isAccessible: form.isAccessible,
    latitude: coordinate(form.latitude, 90) ?? null,
    longitude: coordinate(form.longitude, 180) ?? null,
    location: form.location.trim(),
    description: form.description.trim(),
    url: form.url.trim(),
  };
}

export function FacilityEditor({ facility }: { facility: AdminFacilityResponse }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${facility.name}`}>
          <Pencil />
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit facility</SheetTitle>
          <SheetDescription>Changes are shown in the app as soon as they are saved.</SheetDescription>
        </SheetHeader>
        {open && <FacilityFormBody key={facility.identifier} facility={facility} onSaved={() => setOpen(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function FacilityFormBody({ facility, onSaved }: { facility: AdminFacilityResponse; onSaved: () => void }) {
  const [form, setForm] = useState(() => toForm(facility));
  const save = useSaveFacility(facility.identifier);
  const problem = facilityProblem(form);

  function set(patch: Partial<FacilityForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function toggleType(bit: number, on: boolean) {
    setForm((current) => ({ ...current, facilityType: on ? current.facilityType | bit : current.facilityType & ~bit }));
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
        <TextField label="Name" value={form.name} max={FACILITY_LIMITS.name} onChange={(name) => set({ name })} />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Type</legend>
          {FACILITY_TYPES.map(([bit, label]) => (
            <CheckboxField
              key={bit}
              label={label}
              checked={(form.facilityType & bit) !== 0}
              onChange={(on) => toggleType(bit, on)}
            />
          ))}
        </fieldset>

        <CheckboxField
          label="Accessible"
          checked={form.isAccessible}
          onChange={(isAccessible) => set({ isAccessible })}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Latitude">
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={form.latitude}
                onChange={(e) => set({ latitude: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Longitude">
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={form.longitude}
                onChange={(e) => set({ longitude: e.target.value })}
              />
            )}
          </FormField>
        </div>
        <p className="text-muted-foreground -mt-3 text-xs">
          Leave both empty for a place without a point, such as a fishing or swimming area.
        </p>

        <TextField
          label="Location"
          value={form.location}
          max={FACILITY_LIMITS.location}
          onChange={(location) => set({ location })}
        />
        <TextField
          label="Description"
          value={form.description}
          max={FACILITY_LIMITS.description}
          multiline
          onChange={(description) => set({ description })}
        />
        <TextField label="Link" value={form.url} max={FACILITY_LIMITS.url} onChange={(url) => set({ url })} />

        {problem && (
          <p role="alert" className="text-destructive text-sm">
            {problem}
          </p>
        )}
      </div>
      <SheetFooter>
        <Button
          disabled={problem !== null || save.isPending}
          onClick={() => save.mutate(toRequest(form), { onSuccess: onSaved })}
        >
          {save.isPending ? "Saving..." : "Save changes"}
        </Button>
        <SheetClose asChild>
          <Button variant="outline">Close</Button>
        </SheetClose>
      </SheetFooter>
    </>
  );
}
