// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import type { Locale } from "@/content/site-content";
import "@/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing #root");

// keep-comment: index.html and en/index.html share this bundle and differ only in <html lang>
const locale: Locale = document.documentElement.lang === "en" ? "en" : "sv";

createRoot(root).render(
  <StrictMode>
    <App locale={locale} />
  </StrictMode>,
);
