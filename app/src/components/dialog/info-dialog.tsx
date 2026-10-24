// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogFrame from "@/components/dialog/dialog-frame";
import { DialogText } from "@/components/dialog/dialog-section";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  icon?: string;
  intro?: string;
  children?: ReactNode;
  testID?: string;
}

export default function InfoDialog({
  visible,
  onDismiss,
  title,
  icon = "information-outline",
  intro,
  children,
  testID = "info-dialog",
}: Props) {
  const { t } = useTranslation();

  return (
    <DialogFrame
      testID={testID}
      visible={visible}
      onDismiss={onDismiss}
      title={title}
      icon={icon}
      showClose
      actions={[{ label: t("common.ok"), onPress: onDismiss, testID: `${testID}-ok` }]}
    >
      {intro && <DialogText>{intro}</DialogText>}
      {children}
    </DialogFrame>
  );
}
