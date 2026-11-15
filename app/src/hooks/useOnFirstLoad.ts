// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useEffect, useEffectEvent, useRef } from "react";

// keep-comment: once per mount, with the first defined value; refetches and later values do not run it again
export function useOnFirstLoad<T>(value: T | undefined, onLoad: (value: T) => void): void {
  const done = useRef(false);
  const handleLoad = useEffectEvent(onLoad);

  useEffect(() => {
    if (value === undefined || done.current) return;
    done.current = true;
    handleLoad(value);
  }, [value]);
}
