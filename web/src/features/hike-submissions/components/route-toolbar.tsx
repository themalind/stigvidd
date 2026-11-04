// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Button } from "@/components/ui/button";
import type { RouteEditor } from "@/features/hike-submissions/hooks/use-route-editor";
import { hasSatellite } from "@/lib/map-style";
import type { EditMode } from "./submission-map";

const MODES: { mode: EditMode; label: string }[] = [
  { mode: "move", label: "Move point" },
  { mode: "delete", label: "Delete point" },
  { mode: "cut", label: "Cut section" },
  { mode: "redraw", label: "Redraw section" },
  { mode: "extend", label: "Extend" },
  { mode: "start", label: "Set start" },
];

interface Props {
  editor: RouteEditor;
  satellite: boolean;
  onToggleSatellite: () => void;
  onResetToOriginal: () => void;
}

export function RouteToolbar({ editor, satellite, onToggleSatellite, onResetToOriginal }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[5px] border p-2">
      {MODES.map(({ mode, label }) => (
        <Button
          key={mode}
          size="sm"
          variant={editor.mode === mode ? "default" : "ghost"}
          aria-pressed={editor.mode === mode}
          onClick={() => editor.changeMode(mode)}
        >
          {label}
        </Button>
      ))}
      <span className="mx-1 h-6 w-px bg-border" />
      <Button size="sm" variant="ghost" onClick={editor.reverse}>
        Reverse
      </Button>
      <Button size="sm" variant="ghost" disabled={!editor.canUndo} onClick={editor.undo}>
        Undo
      </Button>
      <Button size="sm" variant="ghost" onClick={onResetToOriginal}>
        Reset to original
      </Button>
      <span className="flex-1" />
      {hasSatellite && (
        <Button size="sm" variant="outline" aria-pressed={satellite} onClick={onToggleSatellite}>
          {satellite ? "Map" : "Satellite"}
        </Button>
      )}
    </div>
  );
}
