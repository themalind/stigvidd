// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useRef } from "react";
import uuid from "react-native-uuid";

// The same content keeps its key until it is saved, so the server can tell a retry from a new submission.
export function useRetryKey() {
  const last = useRef<{ content: string; key: string } | null>(null);

  return {
    keyFor: (content: unknown): string => {
      const serialized = JSON.stringify(content);
      if (last.current?.content !== serialized) {
        last.current = { content: serialized, key: uuid.v4() };
      }
      return last.current.key;
    },
    forget: () => {
      last.current = null;
    },
  };
}
