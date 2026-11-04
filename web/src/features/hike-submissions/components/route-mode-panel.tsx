// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Button } from "@/components/ui/button";
import type { RouteEditor } from "@/features/hike-submissions/hooks/use-route-editor";

export function RouteModePanel({ editor }: { editor: RouteEditor }) {
  const { mode, anchors, draft, extendFrom } = editor;

  if (mode === "redraw" || mode === "cut") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[5px] border p-3 text-sm">
        {anchors.length < 2 ? (
          <span>
            {`Click the two points the section ${mode === "cut" ? "to remove lies" : "should run"} between (${anchors.length}/2).`}
          </span>
        ) : mode === "cut" ? (
          <span>Everything between the two points goes, and they are joined by a straight line.</span>
        ) : (
          <span>Click on the map to draw the new path ({draft.length} points).</span>
        )}
        <span className="flex-1" />
        <Button size="sm" disabled={anchors.length !== 2} onClick={editor.applyRedraw}>
          {mode === "cut" ? "Cut section" : "Replace section"}
        </Button>
      </div>
    );
  }

  if (mode === "extend") {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[5px] border p-3 text-sm">
        <span>Extend from</span>
        {(["start", "end"] as const).map((from) => (
          <Button
            key={from}
            size="sm"
            variant={extendFrom === from ? "default" : "ghost"}
            aria-pressed={extendFrom === from}
            onClick={() => editor.changeExtendFrom(from)}
          >
            {from === "start" ? "Start" : "End"}
          </Button>
        ))}
        <span>Click on the map to draw outward ({draft.length} points).</span>
        <span className="flex-1" />
        <Button size="sm" disabled={draft.length === 0} onClick={editor.applyExtend}>
          Add to route
        </Button>
      </div>
    );
  }

  return null;
}
