// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { RouterProvider } from "react-router";
import { router } from "./router/router";

export default function App() {
  return <RouterProvider router={router} />;
}
