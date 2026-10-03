// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getValidAccessToken } from "@/services/keycloak-auth";
import { describeRequest, logRefused, logUnanswered } from "./mutator";

// The generated orval client + `customFetch` mutator assume JSON responses, so
// export (binary zip) and import (raw file upload) use raw fetch here. Auth
// follows the same Keycloak-bearer convention as the mutator.

const apiBase = () => import.meta.env.VITE_API_URL as string;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Downloads a full migration archive and saves it to the user's disk. */
export async function exportData(): Promise<void> {
  const path = "/api/v1/admin/export";
  const request = describeRequest(path, "GET");
  const headers = await authHeaders();

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, { headers });
  } catch (error) {
    logUnanswered(request, error);
    throw error;
  }
  if (!response.ok) {
    const message = `Export failed (HTTP ${response.status})`;
    logRefused(request, response.status, message);
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? "stigvidd-export.zip";

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Uploads a migration archive to REPLACE this host's data. Returns the server message. */
export async function importData(file: File): Promise<string> {
  const path = "/api/v1/admin/import";
  const request = describeRequest(path, "POST");
  const headers = { "Content-Type": "application/zip", ...(await authHeaders()) };

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, { method: "POST", headers, body: file });
  } catch (error) {
    logUnanswered(request, error);
    throw error;
  }

  const text = await response.text();
  let message = text;
  try {
    message = (JSON.parse(text) as { message?: string }).message ?? text;
  } catch {
    // Non-JSON body — keep the raw text.
  }

  if (!response.ok) {
    const failure = message || `Import failed (HTTP ${response.status})`;
    logRefused(request, response.status, failure);
    throw new Error(failure);
  }
  return message;
}
