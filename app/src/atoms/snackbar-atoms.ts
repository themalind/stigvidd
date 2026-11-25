// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import type { MaterialIcons } from "@expo/vector-icons";
import { atom } from "jotai";
import type { ComponentProps } from "react";

type IconName = ComponentProps<typeof MaterialIcons>["name"];

export type SnackbarState = {
  visible: boolean;
  message: string;
  type: "success" | "error" | "warning";
  icon?: IconName;
};

export const snackbarAtom = atom<SnackbarState>({
  visible: false,
  message: "",
  type: "success",
  icon: undefined,
});

export const showSuccessAtom = atom(null, (_get, set, message: string, icon?: IconName) => {
  set(snackbarAtom, {
    visible: true,
    message,
    type: "success",
    icon: icon || "check-circle",
  });
});

export const showErrorAtom = atom(null, (_get, set, message: string, icon?: IconName) => {
  set(snackbarAtom, {
    visible: true,
    message,
    type: "error",
    icon: icon || "error-outline",
  });
});

export const hideSnackbarAtom = atom(null, (_get, set) => {
  set(snackbarAtom, (prev) => ({ ...prev, visible: false }));
});

export const showWarningAtom = atom(null, (_get, set, message: string) => {
  set(snackbarAtom, {
    visible: true,
    message,
    type: "warning",
    icon: "warning",
  });
});
