// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useRetryKey } from "@/hooks/useRetryKey";
import { renderHook } from "@testing-library/react-native";

async function retryKey() {
  const { result } = await renderHook(() => useRetryKey());
  return result;
}

it("keeps the key while the content is the same, so a retry is recognised", async () => {
  const result = await retryKey();

  const first = result.current.keyFor({ body: "Hej" });

  expect(first).toMatch(/^[0-9a-f-]{36}$/);
  expect(result.current.keyFor({ body: "Hej" })).toBe(first);
});

it("takes a new key for changed content, so an edited submission is not dropped as a retry", async () => {
  const result = await retryKey();

  const first = result.current.keyFor({ body: "Hej" });

  expect(result.current.keyFor({ body: "Hej då" })).not.toBe(first);
});

it("takes a new key after a save, so the same text can be sent again on purpose", async () => {
  const result = await retryKey();

  const first = result.current.keyFor("Ok");
  result.current.forget();

  expect(result.current.keyFor("Ok")).not.toBe(first);
});
