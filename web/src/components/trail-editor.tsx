import { CLASSIFICATION, type TrailShortInfoResponse } from "@/types/types";
import { Button } from "./ui/button";
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
import { Edit } from "lucide-react";
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
import { useEffect, useState } from "react";

interface Props {
  data: TrailShortInfoResponse;
  selected: boolean;
}

export default function TrailEditor({ data, selected }: Props) {
  const [formData, setFormData] = useState(data);

  useEffect(() => {
    setFormData(data);
  }, [data]);

  return (
    <Sheet>
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
        <div className="grid flex-1 auto-rows-min gap-4 px-4">
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
            <p>City</p>
            <Input
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <p>Classification</p>
            <Select
              value={formData.classification.toString()}
              onValueChange={(v) =>
                setFormData({ ...formData, classification: Number(v) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Svårighetsgrad</SelectLabel>
                  {Object.entries(CLASSIFICATION)
                    .reverse()
                    .map(([key, value]) => {
                      return (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      );
                    })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter>
          <Button type="submit">Save changes</Button>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
