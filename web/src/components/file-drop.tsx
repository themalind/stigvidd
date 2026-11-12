// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useId, useRef, useState } from "react";
import { FileCheck2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/utils/format";

interface Props {
  label: string;
  accept: string;
  hint: string;
  file: File | null;
  disabled?: boolean;
  onChange: (file: File | null) => void;
}

// keep-comment: one file, chosen by a click or a drop; once chosen it shows its name so the choice is visible
export function FileDrop({ label, accept, hint, file, disabled = false, onChange }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function choose(chosen: File | null) {
    onChange(chosen);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => choose(event.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="flex items-center gap-3 rounded-xs border bg-muted/40 p-3">
          <FileCheck2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Change
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => choose(null)}
          >
            <X />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!disabled) choose(event.dataTransfer.files[0] ?? null);
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-1 rounded-xs border-2 border-dashed p-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/40 hover:border-muted-foreground",
          )}
        >
          <Upload className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">Drop a file here or click to choose</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </button>
      )}
    </div>
  );
}
