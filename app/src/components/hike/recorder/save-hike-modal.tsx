// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import DialogFrame from "@/components/dialog/dialog-frame";
import { ActiveHike } from "@/data/types";
import { useTranslation } from "react-i18next";
import SaveHikeForm from "./save-hike-form";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSaveSuccess: () => void;
  hike: ActiveHike;
}

export default function SaveHikeModal({ visible, onDismiss, onSaveSuccess, hike }: Props) {
  const { t } = useTranslation();

  return (
    <DialogFrame
      testID="save-hike"
      visible={visible}
      onDismiss={onDismiss}
      title={t("hike.saveTitle")}
      icon="content-save-outline"
      showClose
      actions={[]}
    >
      <SaveHikeForm hike={hike} onDismiss={onDismiss} onSaveSuccess={onSaveSuccess} />
    </DialogFrame>
  );
}
