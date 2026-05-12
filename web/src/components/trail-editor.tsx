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
});

export default function TrailEditor({ data, selected }: Props) {
  const [formData, setFormData] = useState<UpdateTrailRequest>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleOpenChange(open: boolean) {
    if (!open) return;
    setLoading(true);
    try {
      const trail = await getTrailByIdentifier({ identifier: data.identifier });
      setFormData({
        name: trail.name,
        trailLength: trail.trailLenght,
        classification: trail.classification,
        accessibility: trail.accessibility,
        accessibilityInfo: trail.accessibilityInfo,
        trailSymbol: trail.trailSymbol,
        description: trail.description,
        fullDescription: trail.fullDescription,
        tags: trail.tags,
        city: trail.city,
      });
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
      <SheetContent>
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
                <p>City</p>
                <Input
                  value={formData.city ?? ""}
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
                    setFormData({ ...formData, accessibility: checked === true })
                  }
                />
                <p>Accessible</p>
              </div>
              <div className="flex flex-col gap-2">
                <p>Accessibility Info</p>
                <Input
                  value={formData.accessibilityInfo ?? ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      accessibilityInfo: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <p>Trail Symbol</p>
                <Input
                  value={formData.trailSymbol ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, trailSymbol: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <p>Description</p>
                <Textarea
                  value={formData.description ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <p>Full Description</p>
                <Textarea
                  value={formData.fullDescription ?? ""}
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
            </div>
          </div>
        )}

        <SheetFooter>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading}
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
