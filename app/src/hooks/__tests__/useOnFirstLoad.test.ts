// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useOnFirstLoad } from "@/hooks/useOnFirstLoad";
import { renderHook } from "@testing-library/react-native";

async function render(onLoad: (value: number[]) => void) {
  return renderHook(({ value }: { value: number[] | undefined }) => useOnFirstLoad(value, onLoad), {
    initialProps: { value: undefined as number[] | undefined },
  });
}

it("waits until the value is loaded", async () => {
  const onLoad = jest.fn();

  await render(onLoad);

  expect(onLoad).not.toHaveBeenCalled();
});

it("runs once with the first loaded value, not for a refetch", async () => {
  const onLoad = jest.fn();
  const { rerender } = await render(onLoad);

  await rerender({ value: [1] });
  await rerender({ value: [1, 2] });

  expect(onLoad).toHaveBeenCalledTimes(1);
  expect(onLoad).toHaveBeenCalledWith([1]);
});

it("runs for an empty list, which is loaded too", async () => {
  const onLoad = jest.fn();
  const { rerender } = await render(onLoad);

  await rerender({ value: [] });

  expect(onLoad).toHaveBeenCalledWith([]);
});
