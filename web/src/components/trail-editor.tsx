// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  CLASSIFICATION,
  type TrailShortInfoResponse,
  type UpdateTrailRequest,
} from "@/types/types";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Textarea } from "./ui/textarea";
import { TagInput } from "./tag-input";
import { Edit } from "lucide-react";
import { useState } from "react";
import { getTrailByIdentifier, updateTrail } from "@/api/trail";
import { toast } from "sonner";
import { Separator } from "./ui/separator";

interface Props {
  data: TrailShortInfoResponse;
  selected: boolean;
}

const emptyForm = (): UpdateTrailRequest => ({
  name: "",
  trailLength: 0,
  classification: 0,
  accessibility: false,
  accessibilityInfo: "",
  trailSymbol: "",
  description: "",
  fullDescription: "",
  tags: "",
  city: "",
  visitorInformation: {
    gettingThere: "",
    publicTransport: "",
    parking: "",
    illumination: false,
    illuminationText: "",
    maintainedBy: "",
    winterMaintenance: false,
  },
});

// Mirrors the max lengths in UpdateTrailRequestValidator; over these the API
// rejects the whole request with a 400.
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
} as const;

function FieldHeader({
  label,
  value,
  max,
}: {
  label: string;
  value: string;
  max: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p>{label}</p>
      <span
        className={
          value.length === max
            ? "text-destructive text-xs"
            : "text-muted-foreground text-xs"
        }
      >
        {value.length}/{max}
      </span>
    </div>
  );
}

export default function TrailEditor({ data, selected }: Props) {
  const [formData, setFormData] = useState<UpdateTrailRequest>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleOpenChange(open: boolean) {
    if (!open) return;
    setLoading(true);
    setLoaded(false);
    try {
      const trail = await getTrailByIdentifier({ identifier: data.identifier });
      setFormData({
        name: trail.name,
        trailLength: trail.trailLength,
        classification: trail.classification,
        accessibility: trail.accessibility,
        accessibilityInfo: trail.accessibilityInfo,
        trailSymbol: trail.trailSymbol,
        description: trail.description,
        fullDescription: trail.fullDescription,
        tags: trail.tags,
        city: trail.city,
        visitorInformation: {
          gettingThere: trail.visitorInformation?.gettingThere ?? "",
          publicTransport: trail.visitorInformation?.publicTransport ?? "",
          parking: trail.visitorInformation?.parking ?? "",
          illumination: trail.visitorInformation?.illumination ?? false,
          illuminationText: trail.visitorInformation?.illuminationText ?? "",
          maintainedBy: trail.visitorInformation?.maintainedBy ?? "",
          winterMaintenance:
            trail.visitorInformation?.winterMaintenance ?? false,
        },
      });
      setLoaded(true);
    } catch {
      toast.error("Failed to load trail data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await updateTrail(data.identifier, formData);
      toast.success("Trail updated successfully.");
    } catch {
      toast.error("Failed to update trail.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet onOpenChange={handleOpenChange}>
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
            All changes you make are permanent and cannot be undone. There is no
            undo function available. Any modifications will be applied directly
            to the live database. Please review your changes carefully before
            proceeding.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        ) : !loaded ? (
          <div className="flex flex-1 items-center justify-center px-4">
            <p className="text-muted-foreground text-sm">
              This trail could not be loaded, so there is nothing to edit. Close
              the panel and open it again.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid auto-rows-min gap-4 px-4">
              <div className="flex flex-col gap-2">
                <p>Name</p>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <p>Trail Length (km)</p>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={formData.trailLength}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      trailLength: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="City"
                  value={formData.city ?? ""}
                  max={LIMITS.city}
                />
                <Input
                  value={formData.city ?? ""}
                  maxLength={LIMITS.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <p>Classification</p>
                <Select
                  value={formData.classification?.toString() ?? "0"}
                  onValueChange={(v) =>
                    setFormData({ ...formData, classification: Number(v) })
                  }
                >
                  <SelectTrigger className="w-full">
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
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="accessibility"
                  checked={formData.accessibility ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      accessibility: checked === true,
                    })
                  }
                />
                <p>Accessible</p>
              </div>
              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="Accessibility Info"
                  value={formData.accessibilityInfo ?? ""}
                  max={LIMITS.accessibilityInfo}
                />
                <Input
                  value={formData.accessibilityInfo ?? ""}
                  maxLength={LIMITS.accessibilityInfo}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accessibilityInfo: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="Trail Symbol"
                  value={formData.trailSymbol ?? ""}
                  max={LIMITS.trailSymbol}
                />
                <Input
                  value={formData.trailSymbol ?? ""}
                  maxLength={LIMITS.trailSymbol}
                  onChange={(e) =>
                    setFormData({ ...formData, trailSymbol: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="Description"
                  value={formData.description ?? ""}
                  max={LIMITS.description}
                />
                <Textarea
                  value={formData.description ?? ""}
                  maxLength={LIMITS.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="Full Description"
                  value={formData.fullDescription ?? ""}
                  max={LIMITS.fullDescription}
                />
                <Textarea
                  value={formData.fullDescription ?? ""}
                  maxLength={LIMITS.fullDescription}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fullDescription: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <p>Tags</p>
                <TagInput
                  value={formData.tags ?? ""}
                  onChange={(tags) => setFormData({ ...formData, tags })}
                />
              </div>

              <Separator className="mt-3" />

              <p className="font-semibold">Visitor Information</p>

              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="Getting There"
                  value={formData.visitorInformation?.gettingThere ?? ""}
                  max={LIMITS.gettingThere}
                />
                <Textarea
                  value={formData.visitorInformation?.gettingThere ?? ""}
                  maxLength={LIMITS.gettingThere}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      visitorInformation: {
                        ...formData.visitorInformation,
                        gettingThere: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="Public Transport"
                  value={formData.visitorInformation?.publicTransport ?? ""}
                  max={LIMITS.publicTransport}
                />
                <Textarea
                  value={formData.visitorInformation?.publicTransport ?? ""}
                  maxLength={LIMITS.publicTransport}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      visitorInformation: {
                        ...formData.visitorInformation,
                        publicTransport: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="Parking"
                  value={formData.visitorInformation?.parking ?? ""}
                  max={LIMITS.parking}
                />
                <Textarea
                  value={formData.visitorInformation?.parking ?? ""}
                  maxLength={LIMITS.parking}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      visitorInformation: {
                        ...formData.visitorInformation,
                        parking: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="illumination"
                  checked={formData.visitorInformation?.illumination ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      visitorInformation: {
                        ...formData.visitorInformation,
                        illumination: checked === true,
                      },
                    })
                  }
                />
                <p>Illuminated</p>
              </div>
              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="Illumination Info"
                  value={formData.visitorInformation?.illuminationText ?? ""}
                  max={LIMITS.illuminationText}
                />
                <Input
                  value={formData.visitorInformation?.illuminationText ?? ""}
                  maxLength={LIMITS.illuminationText}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      visitorInformation: {
                        ...formData.visitorInformation,
                        illuminationText: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <FieldHeader
                  label="Maintained By"
                  value={formData.visitorInformation?.maintainedBy ?? ""}
                  max={LIMITS.maintainedBy}
                />
                <Input
                  value={formData.visitorInformation?.maintainedBy ?? ""}
                  maxLength={LIMITS.maintainedBy}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      visitorInformation: {
                        ...formData.visitorInformation,
                        maintainedBy: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="winterMaintenance"
                  checked={
                    formData.visitorInformation?.winterMaintenance ?? false
                  }
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      visitorInformation: {
                        ...formData.visitorInformation,
                        winterMaintenance: checked === true,
                      },
                    })
                  }
                />
                <p>Winter Maintenance</p>
              </div>
            </div>
          </div>
        )}

        <SheetFooter>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading || !loaded}
          >
            {submitting ? "Saving..." : "Save changes"}
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
