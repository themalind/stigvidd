// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import type {
  AdminTrailListItemResponse,
  TrailResponse,
  UpdateTrailLinkRequest,
  UpdateTrailRequest,
  UpdateVisitorInformationRequest,
} from "@/api/generated/model";
import { CLASSIFICATION } from "@/utils/classification";
import { QueryBoundary } from "@/components/query-boundary";
import { CheckboxField, FormField, TextField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { TagInput } from "@/components/tag-input";
import { Edit, Plus, X } from "lucide-react";
import { useState } from "react";
import { trailQueryOptions, useForgetTrail, useUpdateTrail } from "@/features/trails/api/trail";
import { Separator } from "@/components/ui/separator";

interface Props {
  data: Pick<AdminTrailListItemResponse, "identifier">;
  selected: boolean;
}

type VisitorForm = {
  [K in keyof UpdateVisitorInformationRequest]-?: NonNullable<UpdateVisitorInformationRequest[K]>;
};

const toForm = (trail: TrailResponse): UpdateTrailRequest => ({
  name: trail.name ?? "",
  trailLength: trail.trailLength ?? 0,
  classification: trail.classification ?? 0,
  accessibility: trail.accessibility ?? false,
  accessibilityInfo: trail.accessibilityInfo ?? "",
  trailSymbol: trail.trailSymbol ?? "",
  description: trail.description ?? "",
  fullDescription: trail.fullDescription ?? "",
  tags: trail.tags ?? "",
  city: trail.city ?? "",
  visitorInformation: toVisitorForm(trail.visitorInformation ?? undefined),
  links: (trail.trailLinksResponse ?? []).map(({ identifier, title, link }) => ({ identifier, title, link })),
});

function toVisitorForm(visitor: UpdateVisitorInformationRequest | undefined): VisitorForm {
  return {
    gettingThere: visitor?.gettingThere ?? "",
    publicTransport: visitor?.publicTransport ?? "",
    parking: visitor?.parking ?? "",
    illumination: visitor?.illumination ?? false,
    illuminationText: visitor?.illuminationText ?? "",
    maintainedBy: visitor?.maintainedBy ?? "",
    winterMaintenance: visitor?.winterMaintenance ?? false,
  };
}

// keep-comment: mirrors UpdateTrailRequestValidator's max lengths; over one, the API rejects the whole request with a 400
const LIMITS = {
  city: 30,
  accessibilityInfo: 200,
  trailSymbol: 40,
  description: 800,
  fullDescription: 2000,
  gettingThere: 400,
  publicTransport: 400,
  parking: 400,
  illuminationText: 400,
  maintainedBy: 100,
  linkTitle: 100,
  link: 500,
} as const;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function linkProblem(link: UpdateTrailLinkRequest): string | null {
  if (!link.title.trim()) return "Give the link a title.";
  if (!isHttpUrl(link.link)) return "Enter a full address starting with https://";
  return null;
}

function EditorFooter({ canSave, saving, onSave }: { canSave: boolean; saving: boolean; onSave?: () => void }) {
  return (
    <SheetFooter>
      <Button onClick={onSave} disabled={!canSave || saving}>
        {saving ? "Saving..." : "Save changes"}
      </Button>
      <SheetClose asChild>
        <Button variant="outline">Close</Button>
      </SheetClose>
    </SheetFooter>
  );
}

function EditorMessage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-1 items-center justify-center px-4">{children}</div>
      <EditorFooter canSave={false} saving={false} />
    </>
  );
}

export default function TrailEditor({ data, selected }: Props) {
  const forget = useForgetTrail(data.identifier);

  return (
    <Sheet onOpenChange={(open) => open && forget()}>
      <SheetTrigger asChild>
        {selected ? (
          <Button variant="ghost">
            <Edit />
          </Button>
        ) : null}
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit Trail</SheetTitle>
          <SheetDescription>
            All changes you make are permanent and cannot be undone. There is no undo function available. Any
            modifications will be applied directly to the live database. Please review your changes carefully before
            proceeding.
          </SheetDescription>
        </SheetHeader>

        <QueryBoundary
          fallback={
            <EditorMessage>
              <p className="text-muted-foreground text-sm">Loading...</p>
            </EditorMessage>
          }
          errorFallback={({ retry }) => (
            <EditorMessage>
              <div className="flex flex-col items-center gap-3">
                <p className="text-muted-foreground text-sm">
                  This trail could not be loaded, so there is nothing to edit.
                </p>
                <Button size="sm" variant="outline" onClick={retry}>
                  Try again
                </Button>
              </div>
            </EditorMessage>
          )}
        >
          <LoadedTrail identifier={data.identifier} />
        </QueryBoundary>
      </SheetContent>
    </Sheet>
  );
}

function LoadedTrail({ identifier }: { identifier: string }) {
  const { data: trail } = useSuspenseQuery(trailQueryOptions(identifier));

  return <TrailForm key={identifier} identifier={identifier} trail={trail} />;
}

function TrailForm({ identifier, trail }: { identifier: string; trail: TrailResponse }) {
  const [formData, setFormData] = useState<UpdateTrailRequest>(() => toForm(trail));
  const save = useUpdateTrail(identifier);

  const visitor = toVisitorForm(formData.visitorInformation ?? undefined);
  const links = formData.links ?? [];
  const linksValid = links.every((link) => linkProblem(link) === null);

  function set(patch: Partial<UpdateTrailRequest>) {
    setFormData((current) => ({ ...current, ...patch }));
  }

  function setVisitor(patch: Partial<VisitorForm>) {
    setFormData((current) => ({
      ...current,
      visitorInformation: { ...toVisitorForm(current.visitorInformation ?? undefined), ...patch },
    }));
  }

  function setLinks(next: UpdateTrailLinkRequest[]) {
    set({ links: next });
  }

  function setLink(index: number, patch: Partial<UpdateTrailLinkRequest>) {
    setLinks(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="grid auto-rows-min gap-4 px-4">
          <TextField label="Name" value={formData.name} onChange={(name) => set({ name })} />
          <FormField label="Trail Length (km)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                step={0.1}
                value={formData.trailLength}
                onChange={(e) => set({ trailLength: Number(e.target.value) })}
              />
            )}
          </FormField>
          <TextField label="City" value={formData.city ?? ""} max={LIMITS.city} onChange={(city) => set({ city })} />
          <FormField label="Classification">
            {(id) => (
              <Select
                value={formData.classification?.toString() ?? "0"}
                onValueChange={(v) => set({ classification: Number(v) })}
              >
                <SelectTrigger id={id} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Difficulty</SelectLabel>
                    {Object.entries(CLASSIFICATION)
                      .reverse()
                      .map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </FormField>
          <CheckboxField
            label="Accessible"
            checked={formData.accessibility ?? false}
            onChange={(accessibility) => set({ accessibility })}
          />
          <TextField
            label="Accessibility Info"
            value={formData.accessibilityInfo ?? ""}
            max={LIMITS.accessibilityInfo}
            onChange={(accessibilityInfo) => set({ accessibilityInfo })}
          />
          <TextField
            label="Trail Symbol"
            value={formData.trailSymbol ?? ""}
            max={LIMITS.trailSymbol}
            onChange={(trailSymbol) => set({ trailSymbol })}
          />
          <TextField
            label="Description"
            value={formData.description ?? ""}
            max={LIMITS.description}
            multiline
            onChange={(description) => set({ description })}
          />
          <TextField
            label="Full Description"
            value={formData.fullDescription ?? ""}
            max={LIMITS.fullDescription}
            multiline
            onChange={(fullDescription) => set({ fullDescription })}
          />
          <FormField label="Tags">
            {() => <TagInput value={formData.tags ?? ""} onChange={(tags) => set({ tags })} />}
          </FormField>

          <Separator className="mt-3" />

          <p className="font-semibold">Visitor Information</p>

          <TextField
            label="Getting There"
            value={visitor.gettingThere}
            max={LIMITS.gettingThere}
            multiline
            onChange={(gettingThere) => setVisitor({ gettingThere })}
          />
          <TextField
            label="Public Transport"
            value={visitor.publicTransport}
            max={LIMITS.publicTransport}
            multiline
            onChange={(publicTransport) => setVisitor({ publicTransport })}
          />
          <TextField
            label="Parking"
            value={visitor.parking}
            max={LIMITS.parking}
            multiline
            onChange={(parking) => setVisitor({ parking })}
          />
          <CheckboxField
            label="Illuminated"
            checked={visitor.illumination}
            onChange={(illumination) => setVisitor({ illumination })}
          />
          <TextField
            label="Illumination Info"
            value={visitor.illuminationText}
            max={LIMITS.illuminationText}
            onChange={(illuminationText) => setVisitor({ illuminationText })}
          />
          <TextField
            label="Maintained By"
            value={visitor.maintainedBy}
            max={LIMITS.maintainedBy}
            onChange={(maintainedBy) => setVisitor({ maintainedBy })}
          />
          <CheckboxField
            label="Winter Maintenance"
            checked={visitor.winterMaintenance}
            onChange={(winterMaintenance) => setVisitor({ winterMaintenance })}
          />

          <Separator className="mt-3" />

          <p className="font-semibold">Links</p>

          {links.length === 0 ? <p className="text-muted-foreground text-sm">No links yet.</p> : null}

          {links.map((link, index) => {
            const problem = linkProblem(link);
            return (
              <div key={link.identifier ?? `new-${index}`} className="flex flex-col gap-2 rounded-xs border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Link ${index + 1} title`}
                    placeholder="Title"
                    value={link.title}
                    maxLength={LIMITS.linkTitle}
                    onChange={(e) => setLink(index, { title: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove link ${index + 1}`}
                    onClick={() => setLinks(links.filter((_, i) => i !== index))}
                  >
                    <X />
                  </Button>
                </div>
                <Input
                  aria-label={`Link ${index + 1} address`}
                  placeholder="https://"
                  type="url"
                  value={link.link}
                  maxLength={LIMITS.link}
                  onChange={(e) => setLink(index, { link: e.target.value })}
                />
                {problem ? <p className="text-destructive text-xs">{problem}</p> : null}
              </div>
            );
          })}

          <Button
            variant="outline"
            className="mb-4 self-start"
            onClick={() => setLinks([...links, { title: "", link: "" }])}
          >
            <Plus />
            Add link
          </Button>
        </div>
      </div>
      <EditorFooter canSave={linksValid} saving={save.isPending} onSave={() => save.mutate(formData)} />
    </>
  );
}
