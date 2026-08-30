// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MigrationPage from "./migration-page";

const api = vi.hoisted(() => ({ exportData: vi.fn(), importData: vi.fn() }));
vi.mock("@/api/admin", () => api);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

// The confirmation phrase is this host's name, which under jsdom is `localhost`.
const HOST = window.location.hostname;

// The label becomes "Importing…" while the restore is in flight, so the button has to be
// found by either of its two names.
const importButton = () =>
  screen.getByRole("button", { name: /Import and replace|Importing/ });
const confirmBox = () => screen.getByLabelText(/to confirm you want to overwrite/);
const archiveBox = () => screen.getByLabelText(/Migration archive/);

function archive(name = "host.zip") {
  return new File(["zip-bytes"], name, { type: "application/zip" });
}

beforeEach(() => {
  api.exportData.mockResolvedValue(undefined);
  api.importData.mockResolvedValue("Restored 41 trails.");
});

describe("export", () => {
  it("downloads on request", async () => {
    render(<MigrationPage />);

    await userEvent.click(screen.getByRole("button", { name: /Export all data/ }));

    await waitFor(() => expect(api.exportData).toHaveBeenCalledOnce());
    expect(toasts.success).toHaveBeenCalled();
  });

  it("reports a failed export rather than a finished one", async () => {
    api.exportData.mockRejectedValue(new Error("Export failed (HTTP 500)"));
    render(<MigrationPage />);

    await userEvent.click(screen.getByRole("button", { name: /Export all data/ }));

    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith("Export failed (HTTP 500)"),
    );
    expect(toasts.success).not.toHaveBeenCalled();
  });
});

/**
 * Import overwrites the database, the media and the Keycloak realm on this host. The
 * operator has to name the host to arm it, and that arming is the only thing standing
 * between a stray click and losing everything.
 */
describe("the import arming gate", () => {
  it("is dead on arrival", () => {
    render(<MigrationPage />);

    expect(importButton()).toBeDisabled();
  });

  it("stays dead with an archive but no confirmation", async () => {
    render(<MigrationPage />);

    await userEvent.upload(archiveBox(), archive());

    expect(importButton()).toBeDisabled();
  });

  it("stays dead with the confirmation but no archive", async () => {
    render(<MigrationPage />);

    await userEvent.type(confirmBox(), HOST);

    expect(importButton()).toBeDisabled();
  });

  it("refuses a confirmation that is merely close", async () => {
    render(<MigrationPage />);
    await userEvent.upload(archiveBox(), archive());

    await userEvent.type(confirmBox(), `${HOST} `);

    expect(importButton()).toBeDisabled();
  });

  it("refuses a confirmation in the wrong case", async () => {
    render(<MigrationPage />);
    await userEvent.upload(archiveBox(), archive());

    await userEvent.type(confirmBox(), HOST.toUpperCase());

    expect(importButton()).toBeDisabled();
  });

  it("arms only on the archive and the host's own name together", async () => {
    render(<MigrationPage />);

    await userEvent.upload(archiveBox(), archive());
    await userEvent.type(confirmBox(), HOST);

    expect(importButton()).toBeEnabled();
  });

  it("disarms again when the confirmation is edited away", async () => {
    render(<MigrationPage />);
    await userEvent.upload(archiveBox(), archive());
    await userEvent.type(confirmBox(), HOST);

    await userEvent.type(confirmBox(), "x");

    expect(importButton()).toBeDisabled();
  });

  it("names the host the operator has to type", () => {
    render(<MigrationPage />);

    expect(confirmBox()).toHaveAttribute("placeholder", HOST);
  });
});

describe("running the import", () => {
  async function arm() {
    render(<MigrationPage />);
    await userEvent.upload(archiveBox(), archive());
    await userEvent.type(confirmBox(), HOST);
  }

  it("sends the archive that was picked", async () => {
    await arm();

    await userEvent.click(importButton());

    await waitFor(() => expect(api.importData).toHaveBeenCalledOnce());
    expect(vi.mocked(api.importData).mock.calls[0][0]).toBeInstanceOf(File);
    expect((vi.mocked(api.importData).mock.calls[0][0] as File).name).toBe("host.zip");
  });

  // Two clicks on a restore that replaces the host must not be two restores.
  it("sends one request however fast the button is clicked twice", async () => {
    let release: (value: string) => void = () => {};
    api.importData.mockReturnValue(new Promise<string>((resolve) => (release = resolve)));
    await arm();

    await userEvent.click(importButton());

    expect(importButton()).toBeDisabled();
    expect(api.importData).toHaveBeenCalledOnce();

    release("Restored.");
  });

  it("locks the inputs while it runs, so the archive cannot change under it", async () => {
    let release: (value: string) => void = () => {};
    api.importData.mockReturnValue(new Promise<string>((resolve) => (release = resolve)));
    await arm();

    await userEvent.click(importButton());

    expect(archiveBox()).toBeDisabled();
    expect(confirmBox()).toBeDisabled();

    release("Restored.");
  });

  it("shows what the server said it restored", async () => {
    await arm();

    await userEvent.click(importButton());

    await waitFor(() =>
      expect(toasts.success).toHaveBeenCalledWith(
        "Restored 41 trails.",
        expect.anything(),
      ),
    );
  });

  it("disarms after a successful run, so a second click cannot repeat it", async () => {
    await arm();

    await userEvent.click(importButton());

    await waitFor(() => expect(importButton()).toBeDisabled());
    expect(confirmBox()).toHaveValue("");
  });

  // A failed restore leaves the host in an unknown state; the operator should be able to
  // read the reason and try again without re-arming from scratch.
  it("reports a refusal and does not claim success", async () => {
    api.importData.mockRejectedValue(new Error("Archive was produced by a newer version."));
    await arm();

    await userEvent.click(importButton());

    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith(
        "Archive was produced by a newer version.",
      ),
    );
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("stays armed after a failure, rather than silently dropping the archive", async () => {
    api.importData.mockRejectedValue(new Error("HTTP 500"));
    await arm();

    await userEvent.click(importButton());

    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(importButton()).toBeEnabled();
    expect(confirmBox()).toHaveValue(HOST);
  });
});
