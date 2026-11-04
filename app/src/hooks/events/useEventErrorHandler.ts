// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showErrorAtom, showWarningAtom } from "@/atoms/snackbar-atoms";
import { eventErrorKey } from "@/utils/event-errors";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export function useEventErrorHandler() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setWarningMsg = useSetAtom(showWarningAtom);

  // `gone` is an event the viewer can no longer read; refetching its open screen would 404. keep-comment: see docs/notes/removing-an-observed-query-does-not-stop-its-refetch.md
  const refresh = useCallback(
    (gone?: string) => {
      void queryClient.invalidateQueries({
        queryKey: ["events"],
        predicate: (query) => gone === undefined || query.queryKey[2] !== gone,
      });
    },
    [queryClient],
  );

  // A known code means the screen showed an old picture: say why and redraw it. keep-comment: the stale-state rule
  const onEventError = useCallback(
    (error: unknown, action?: "join") => {
      const key = eventErrorKey(error, action);
      refresh();
      if (key === undefined) {
        setErrorMsg(t("events.errors.generic"));
        return;
      }
      setWarningMsg(t(key));
    },
    [refresh, setErrorMsg, setWarningMsg, t],
  );

  return { refresh, onEventError };
}
