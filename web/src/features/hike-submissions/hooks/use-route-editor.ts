// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { EditMode } from "@/features/hike-submissions/components/submission-map";
import {
  deletePoint,
  extendPath,
  findJumps,
  insertPoint,
  type LngLat,
  movePoint,
  replaceSection,
  reversePath,
  startLoopAt,
  trimPath,
} from "@/utils/geometry-edit";

export type ExtendFrom = "start" | "end";

type Range = [number, number];

const fullRange = (path: LngLat[]): Range => [0, Math.max(0, path.length - 1)];

export function useRouteEditor(initial: LngLat[]) {
  const [path, setPath] = useState(initial);
  const [history, setHistory] = useState<{ path: LngLat[]; range: Range }[]>([]);
  const [range, setRange] = useState<Range>(() => fullRange(initial));
  const [mode, setMode] = useState<EditMode>("move");
  const [anchors, setAnchors] = useState<number[]>([]);
  const [draft, setDraft] = useState<LngLat[]>([]);
  const [extendFrom, setExtendFrom] = useState<ExtendFrom>("end");

  const kept = useMemo(() => trimPath(path, range[0], range[1]), [path, range]);
  const jumps = useMemo(
    () => findJumps(path).filter((j) => j.index >= range[0] && j.index + 1 <= range[1]),
    [path, range],
  );
  const dirty = history.length > 0 || range[0] > 0 || range[1] < path.length - 1;

  const edit = (next: LngLat[]) => {
    if (next === path) return;
    setHistory((h) => [...h, { path, range }]);
    setPath(next);
    setRange(([start, end]) => [Math.min(start, next.length - 2), Math.min(Math.max(end, 1), next.length - 1)]);
  };

  // keep-comment: works on the kept part, so the trim is applied first and the result is kept whole
  const replaceKept = (next: LngLat[]) => {
    setHistory((h) => [...h, { path, range }]);
    setPath(next);
    setRange(fullRange(next));
  };

  const clearDrawing = () => {
    setAnchors([]);
    setDraft([]);
  };

  const setStart = (index: number) => {
    if (index < range[0] || index > range[1]) return;
    const rotated = startLoopAt(kept, index - range[0]);
    if (!rotated) {
      if (index === range[0]) return;
      if (index === range[1]) {
        toast.error("The start must leave at least two points.");
        return;
      }
      replaceKept(kept.slice(index - range[0]));
      toast.info("Not a loop, so everything before the new start was trimmed.");
      return;
    }
    if (rotated !== kept) replaceKept(rotated);
  };

  return {
    path,
    range,
    kept,
    jumps,
    dirty,
    canUndo: history.length > 0,
    mode,
    anchors,
    draft,
    extendFrom,
    setRange,

    changeMode(next: EditMode) {
      setMode(next);
      clearDrawing();
    },

    changeExtendFrom(from: ExtendFrom) {
      setExtendFrom(from);
      setDraft([]);
    },

    movePoint(index: number, to: LngLat) {
      edit(movePoint(path, index, to));
    },

    insertPoint(afterIndex: number, at: LngLat) {
      const next = insertPoint(path, afterIndex, at);
      if (next === path) return;
      setHistory((h) => [...h, { path, range }]);
      setPath(next);
      setRange(([start, end]) => [afterIndex < start ? start + 1 : start, afterIndex < end ? end + 1 : end]);
    },

    clickPoint(index: number) {
      if (mode === "delete") {
        edit(deletePoint(path, index));
      } else if (mode === "redraw" || mode === "cut") {
        setAnchors((current) => (current.length >= 2 ? [index] : [...current, index]));
        setDraft([]);
      } else if (mode === "start") {
        setStart(index);
      }
    },

    clickMap(at: LngLat) {
      if ((mode === "redraw" && anchors.length === 2) || mode === "extend") setDraft((d) => [...d, at]);
    },

    applyRedraw() {
      if (anchors.length !== 2) return;
      edit(replaceSection(path, anchors[0], anchors[1], draft));
      clearDrawing();
    },

    applyExtend() {
      if (draft.length === 0) return;
      replaceKept(extendPath(kept, extendFrom, draft));
      setDraft([]);
    },

    reverse() {
      replaceKept(reversePath(kept));
    },

    undo() {
      const previous = history.at(-1);
      if (!previous) return;
      setHistory((h) => h.slice(0, -1));
      setPath(previous.path);
      setRange(previous.range);
    },

    reset(to: LngLat[]) {
      setHistory([]);
      setPath(to);
      setRange(fullRange(to));
      clearDrawing();
    },
  };
}

export type RouteEditor = ReturnType<typeof useRouteEditor>;
