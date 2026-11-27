// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AccountBannedDialog from "@/components/auth/account-banned-dialog";
import NotAuthenticatedDialog from "@/components/auth/not-authenticated-msg-dialog";
import { Trail } from "@/data/types";
import { ReviewEditor as Editor } from "@/hooks/review/useReviewEditor";
import AddReview from "./add/add-review-modal";

interface ReviewEditorProps {
  trail: Trail;
  editor: Editor;
  notAuthMessage: string;
}

export default function ReviewEditor({ trail, editor, notAuthMessage }: ReviewEditorProps) {
  return (
    <>
      <AddReview
        trailIdentifier={trail.identifier}
        trailName={trail.name}
        trailLength={trail.trailLength}
        review={editor.form.review}
        visible={editor.form.visible}
        onDismiss={editor.form.onDismiss}
      />
      <AccountBannedDialog visible={editor.blocked === "banned"} onDismiss={editor.dismissBlocked} />
      <NotAuthenticatedDialog
        visible={editor.blocked === "unauthenticated"}
        onDissmiss={editor.dismissBlocked}
        infoMessage={notAuthMessage}
      />
    </>
  );
}
