import { X } from "lucide-react";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

function parseTags(value: string): string[] {
  return value
    .replace(/[[\]"]/g, "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function buildTags(tags: string[]): string {
  return JSON.stringify(tags);
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function TagInput({ value, onChange }: Props) {
  const tags = parseTags(value);

  function removeTag(tag: string) {
    onChange(buildTags(tags.filter((t) => t !== tag)));
  }

  function addTag(tag: string) {
    if (!tag || tags.includes(tag)) return;
    onChange(buildTags([...tags, tag]));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              className="hover:text-destructive"
              onClick={() => removeTag(tag)}
            >
              <X size={12} />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        placeholder="Add tag and press Enter"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          addTag(e.currentTarget.value.trim());
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
