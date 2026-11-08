// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, it, vi } from "vitest";

const maplibre = vi.hoisted(() => ({ setWorkerUrl: vi.fn() }));
vi.mock("maplibre-gl", () => maplibre);

// Every map test fakes maplibre, so nothing else would notice a map that never gets its worker.
it("hands maplibre its bundled worker before any map is made", async () => {
  await import("./maplibre");

  expect(maplibre.setWorkerUrl).toHaveBeenCalledWith(expect.stringContaining("maplibre-gl-worker"));
});
