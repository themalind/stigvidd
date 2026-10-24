// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogFrame from "@/components/dialog/dialog-frame";
import { DialogText } from "@/components/dialog/dialog-section";
import { getDialog, hideDialog, subscribeDialog } from "@/services/dialog";
import { useSyncExternalStore } from "react";

export function DialogHost() {
  const dialog = useSyncExternalStore(subscribeDialog, getDialog);

  // keep-comment: mounted only while shown, so its Portal stacks above modals opened after startup
  if (!dialog) return null;

  return (
    <DialogFrame
      testID="dialog-host"
      visible
      onDismiss={hideDialog}
      title={dialog.title}
      icon={dialog.icon}
      tone={dialog.tone}
      actions={dialog.actions.map((action) => ({
        label: action.label,
        variant: action.variant,
        onPress: () => {
          hideDialog();
          action.onPress?.();
        },
      }))}
    >
      <DialogText>{dialog.message}</DialogText>
    </DialogFrame>
  );
}
