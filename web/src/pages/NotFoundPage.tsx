// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NavLink } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <p>404 - Nothing here...</p>
      <NavLink to={"/"}>Home</NavLink>
    </div>
  );
}
