// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { atom } from "jotai";

export type SnackbarState = {
  visible: boolean;
  message: string;
  type: "success" | "error" | "warning";
  icon?: string;
};

export const snackbarAtom = atom<SnackbarState>({
  visible: false,
  message: "",
  type: "success",
  icon: undefined,
});

// Helper atoms för att visa snackbar
export const showSuccessAtom = atom(null, (get, set, message: string, icon?: string) => {
  set(snackbarAtom, {
    visible: true,
    message,
    type: "success",
    icon: icon || "check-circle",
  });
});

export const showErrorAtom = atom(null, (get, set, message: string, icon?: string) => {
  set(snackbarAtom, {
    visible: true,
    message,
    type: "error",
    icon: icon || "error-outline",
  });
});

export const hideSnackbarAtom = atom(null, (get, set) => {
  set(snackbarAtom, (prev) => ({ ...prev, visible: false }));
});

export const showWarningAtom = atom(null, (get, set, message: string) => {
  set(snackbarAtom, {
    visible: true,
    message,
    type: "warning",
    icon: "warning",
  });
});
