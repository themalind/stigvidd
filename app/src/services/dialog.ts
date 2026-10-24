// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import type { DialogTone } from "@/components/dialog/dialog-frame";

export interface DialogRequestAction {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "danger" | "text";
}

export interface DialogRequest {
  title: string;
  message: string;
  icon?: string;
  tone?: DialogTone;
  actions: DialogRequestAction[];
}

type Listener = () => void;

let current: DialogRequest | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

// keep-comment: for code outside React (utils, hooks' async callbacks); DialogHost in the root layout draws it
export function showDialog(request: DialogRequest) {
  current = request;
  emit();
}

export function hideDialog() {
  current = null;
  emit();
}

export function getDialog() {
  return current;
}

export function subscribeDialog(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
