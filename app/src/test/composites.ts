// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";

type Props = TestInstance["props"];

type FiberNode = {
  type: unknown;
  elementType: unknown;
  memoizedProps: Props;
  child: FiberNode | null;
  sibling: FiberNode | null;
  return: FiberNode | null;
  stateNode?: { current?: FiberNode } | null;
};

export type Composite = { props: Props };

// RNTL 14 exposes host elements only, so the props a composite was handed are read from its fiber. keep-comment: the replacement for the removed UNSAFE_*ByType queries
function topFiber(): FiberNode | null {
  const first = screen.container.children.find((child): child is TestInstance => typeof child !== "string");
  let fiber = (first?.unstable_fiber ?? null) as unknown as FiberNode | null;
  while (fiber?.return) {
    fiber = fiber.return;
  }
  // A host's fiber may belong to the previous commit; the root knows which tree is on screen.
  return fiber?.stateNode?.current ?? fiber;
}

function collect(fiber: FiberNode | null, matches: (node: FiberNode) => boolean, found: Composite[]) {
  for (let node = fiber; node; node = node.sibling) {
    if (matches(node)) {
      found.push({ props: node.memoizedProps });
    }
    collect(node.child, matches, found);
  }
  return found;
}

export function queryAllByType(type: unknown): Composite[] {
  return collect(topFiber(), (node) => node.type === type || node.elementType === type, []);
}

export function getAllByType(type: unknown): Composite[] {
  const found = queryAllByType(type);
  if (found.length === 0) {
    throw new Error("expected at least one element of the given type");
  }
  return found;
}

export function queryByType(type: unknown): Composite | null {
  const found = queryAllByType(type);
  if (found.length > 1) {
    throw new Error(`expected at most one element of the given type, found ${found.length}`);
  }
  return found[0] ?? null;
}

export function closestByType(element: TestInstance, type: unknown): Composite {
  let fiber = element.unstable_fiber as unknown as FiberNode | null;
  while (fiber && fiber.type !== type && fiber.elementType !== type) {
    fiber = fiber.return;
  }
  if (!fiber) {
    throw new Error("expected an ancestor of the given type");
  }
  return { props: fiber.memoizedProps };
}

export function getByType(type: unknown): Composite {
  const found = queryByType(type);
  if (!found) {
    throw new Error("expected one element of the given type");
  }
  return found;
}
