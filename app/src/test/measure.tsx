// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { render } from "@testing-library/react-native";
import { createRef } from "react";
import { View } from "react-native";

type Rect = { x: number; y: number; width: number; height: number };

// Makes measureInWindow call back, which it never does under Jest because no layout runs (see
// docs/notes/app-component-testing-what-layout-can-be-asserted.md). Anything gated on the callback
// — the sort popover's position, and so the popover itself — never appears without this.
//
// Every host instance shares one prototype, so patching it once covers whatever renders next. The
// rectangle is made up; only the arithmetic done on it is under test.
export function stubMeasureInWindow(rect: Rect = { x: 300, y: 50, width: 24, height: 24 }) {
  const ref = createRef<View>();
  const probe = render(<View ref={ref} collapsable={false} />);
  const prototype = Object.getPrototypeOf(ref.current) as {
    measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
  };
  const original = prototype.measureInWindow;
  probe.unmount();

  prototype.measureInWindow = (callback) => callback(rect.x, rect.y, rect.width, rect.height);

  return {
    rect,
    restore() {
      prototype.measureInWindow = original;
    },
  };
}
