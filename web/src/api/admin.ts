import { getValidAccessToken } from "@/services/keycloak-auth";

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
  const response = await fetch(`${apiBase()}/api/v1/admin/export`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Export failed (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? "stigvidd-export.zip";

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
  const response = await fetch(`${apiBase()}/api/v1/admin/import`, {
    method: "POST",
    headers: { "Content-Type": "application/zip", ...(await authHeaders()) },
    body: file,
  });

  const text = await response.text();
  let message = text;
  try {
    message = (JSON.parse(text) as { message?: string }).message ?? text;
  } catch {
    // Non-JSON body — keep the raw text.
  }

  if (!response.ok) {
    throw new Error(message || `Import failed (HTTP ${response.status})`);
  }
  return message;
}
