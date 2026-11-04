// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "@/app/app.tsx";
import Providers from "@/app/provider.tsx";
import { initTelemetry } from "@/lib/telemetry.ts";
import { isStaging } from "@/config/environment.ts";

// At module scope, before the first render, so an error thrown while React is still
// mounting is already covered. No-ops entirely unless VITE_OO_LOGS_* are configured.
initTelemetry();

if (isStaging) {
  document.title = `[STAGING] ${document.title}`;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
