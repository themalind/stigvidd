// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";

const getValidAccessToken = vi.hoisted(() =>
  vi.fn<() => Promise<string | null>>(),
);
vi.mock("@/services/keycloak-auth", () => ({ getValidAccessToken }));

import { exportData, importData } from "./admin";

function reply(
  body: string | null,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(body, { status: init.status ?? 200, headers: init.headers });
}

function request(call = 0) {
  return vi.mocked(fetch).mock.calls[call] as [string, RequestInit];
}

describe("exportData", () => {
  // The download is a real anchor click, which jsdom would try to navigate on.
  const stubClick = () =>
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  let clicked: ReturnType<typeof stubClick>;

  // `mock.instances` records the `this` each call was made on — the anchor itself.
  const savedAs = () =>
    (clicked.mock.instances[0] as unknown as HTMLAnchorElement).download;

  beforeEach(() => {
    clicked = stubClick();
    getValidAccessToken.mockResolvedValue("a-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("archive-bytes")));
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue("blob:archive"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("asks the admin export endpoint, with the bearer token", async () => {
    await exportData();

    const [url, init] = request();
    expect(url).toBe("https://api.test/api/v1/admin/export");
    expect(init.headers).toEqual({ Authorization: "Bearer a-token" });
  });

  it("sends no Authorization header when there is no session", async () => {
    getValidAccessToken.mockResolvedValue(null);

    await exportData();

    expect(request()[1].headers).toEqual({});
  });

  it("saves the archive under the name the server gave it", async () => {
    vi.mocked(fetch).mockResolvedValue(
      reply("archive-bytes", {
        headers: {
          "Content-Disposition": 'attachment; filename="stigvidd-2026-08-25.zip"',
        },
      }),
    );
    await exportData();

    expect(savedAs()).toBe("stigvidd-2026-08-25.zip");
  });

  it("reads an unquoted filename too", async () => {
    vi.mocked(fetch).mockResolvedValue(
      reply("archive-bytes", {
        headers: { "Content-Disposition": "attachment; filename=host.zip" },
      }),
    );
    await exportData();

    expect(savedAs()).toBe("host.zip");
  });

  it("falls back to a name of its own when the header says nothing", async () => {
    await exportData();

    expect(savedAs()).toBe("stigvidd-export.zip");
  });

  it("leaves no anchor behind in the document", async () => {
    await exportData();

    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:archive");
  });

  it("throws rather than saving an error page as an archive", async () => {
    vi.mocked(fetch).mockResolvedValue(reply("nope", { status: 500 }));

    await expect(exportData()).rejects.toThrow("Export failed (HTTP 500)");
    expect(clicked).not.toHaveBeenCalled();
  });
});

/**
 * The most destructive call in the admin: it overwrites the database, the media and the
 * Keycloak realm on this host. What is asserted here is that it goes to the right place
 * and, above all, that a refusal is never reported as a success.
 */
describe("importData", () => {
  beforeEach(() => {
    getValidAccessToken.mockResolvedValue("a-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply('{"message":"Restored."}')));
  });

  const archive = () =>
    new File(["zip-bytes"], "host.zip", { type: "application/zip" });

  it("posts the archive to the admin import endpoint", async () => {
    await importData(archive());

    const [url, init] = request();
    expect(url).toBe("https://api.test/api/v1/admin/import");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/zip",
      Authorization: "Bearer a-token",
    });
  });

  it("sends the file as the raw body, not as a form", async () => {
    const file = archive();

    await importData(file);

    expect(request()[1].body).toBe(file);
  });

  it("returns the server's own account of what it restored", async () => {
    await expect(importData(archive())).resolves.toBe("Restored.");
  });

  it("returns a non-JSON body as it stands", async () => {
    vi.mocked(fetch).mockResolvedValue(reply("Restored 41 trails."));

    await expect(importData(archive())).resolves.toBe("Restored 41 trails.");
  });

  it("throws with the server's reason when the import is refused", async () => {
    vi.mocked(fetch).mockResolvedValue(
      reply('{"message":"Archive was produced by a newer version."}', { status: 400 }),
    );

    await expect(importData(archive())).rejects.toThrow(
      "Archive was produced by a newer version.",
    );
  });

  it("throws on a refusal that says nothing at all", async () => {
    vi.mocked(fetch).mockResolvedValue(reply("", { status: 500 }));

    await expect(importData(archive())).rejects.toThrow("Import failed (HTTP 500)");
  });

  // The one that matters: a 500 whose body happens to parse must not read as done.
  it("does not resolve on a failure that carried a message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      reply('{"message":"Restore aborted halfway."}', { status: 500 }),
    );

    await expect(importData(archive())).rejects.toThrow("Restore aborted halfway.");
  });
});
