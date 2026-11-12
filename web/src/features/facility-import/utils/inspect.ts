// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// keep-comment: a field with this many different values or fewer can sort features into facility types
export const MAX_TYPE_VALUES = 30;

const SAMPLES = 3;

export const EMPTY_VALUE = "";

export interface FileField {
  name: string;
  samples: string[];
  // keep-comment: every distinct value, or null when there are too many to map one by one
  values: string[] | null;
}

export interface FileSummary {
  points: number;
  fields: FileField[];
}

export type Inspection = { ok: true; summary: FileSummary } | { ok: false; error: string };

function text(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPoint(geometry: unknown): boolean {
  return isObject(geometry) && geometry.type === "Point";
}

// keep-comment: only what the field mapping needs; the server reads the file again and decides what is valid
export function inspectGeoJson(content: string): Inspection {
  let root: unknown;

  try {
    root = JSON.parse(content);
  } catch {
    return { ok: false, error: "The file is not valid GeoJSON." };
  }

  if (!isObject(root) || !Array.isArray(root.features)) return { ok: false, error: "The file has no features." };

  const values = new Map<string, Set<string>>();
  const samples = new Map<string, string[]>();
  const filled = new Map<string, number>();
  let points = 0;

  for (const feature of root.features) {
    if (!isObject(feature) || !isPoint(feature.geometry) || !isObject(feature.properties)) continue;
    points += 1;

    for (const [name, raw] of Object.entries(feature.properties)) {
      const value = text(raw);
      if (!values.has(name)) values.set(name, new Set());
      if (value === null) continue;

      filled.set(name, (filled.get(name) ?? 0) + 1);
      values.get(name)?.add(value);
      const shown = samples.get(name) ?? [];
      if (shown.length < SAMPLES && !shown.includes(value)) samples.set(name, [...shown, value]);
    }
  }

  if (points === 0) return { ok: false, error: "The file has no point features with properties." };

  const fields = [...values.entries()].map(([name, distinct]) => {
    const sorted = [...distinct].sort((a, b) => a.localeCompare(b, "sv"));
    // keep-comment: "" stands for the points without a value, which the server looks up the same way
    const all = (filled.get(name) ?? 0) < points ? [...sorted, EMPTY_VALUE] : sorted;

    return {
      name,
      samples: samples.get(name) ?? [],
      values: distinct.size > 0 && all.length <= MAX_TYPE_VALUES ? all : null,
    };
  });

  return { ok: true, summary: { points, fields } };
}
