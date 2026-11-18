// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { render } from "@testing-library/react-native";
import { ComponentRef, createRef } from "react";
import { View } from "react-native";

type Rect = { x: number; y: number; width: number; height: number };

// keep-comment: under Jest measureInWindow never calls back (no layout), so gated UI never appears
// keep-comment: (docs/notes/app-component-testing-what-layout-can-be-asserted.md); the rect is made up
export async function stubMeasureInWindow(rect: Rect = { x: 300, y: 50, width: 24, height: 24 }) {
  const ref = createRef<ComponentRef<typeof View>>();
  const probe = await render(<View ref={ref} collapsable={false} />);
  const prototype = Object.getPrototypeOf(ref.current) as {
    measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
  };
  const original = prototype.measureInWindow;
  await probe.unmount();

  prototype.measureInWindow = (callback) => callback(rect.x, rect.y, rect.width, rect.height);

  return {
    rect,
    restore() {
      prototype.measureInWindow = original;
    },
  };
}
