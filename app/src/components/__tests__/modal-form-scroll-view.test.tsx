// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getByType } from "@/test/composites";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import ModalFormScrollView from "../modal-form-scroll-view";

const originalOS = Platform.OS;

afterEach(() => {
  Platform.OS = originalOS;
});

async function scrollProps() {
  await render(<ModalFormScrollView />);
  return getByType(KeyboardAwareScrollView).props;
}

describe("ModalFormScrollView", () => {
  it("leaves scrolling to the modal lift on iOS", async () => {
    Platform.OS = "ios";
    expect((await scrollProps()).enableAutomaticScroll).toBe(false);
  });

  it("scrolls the focused field into view on Android", async () => {
    Platform.OS = "android";
    const props = await scrollProps();
    expect(props.enableAutomaticScroll).toBe(true);
    expect(props.enableOnAndroid).toBe(true);
  });
});
