// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { StackActions } from "@react-navigation/native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback } from "react";

// Opens the trail a shared link names on top of the trail list, so back returns to the list. keep-comment: why a link goes through the list (docs/notes/router-push-into-unmounted-tab-has-no-back.md)
export function useOpenLinkedTrail() {
  const { trail } = useLocalSearchParams<{ trail?: string }>();
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      if (!trail) return;
      navigation.setParams({ trail: undefined } as never);
      navigation.dispatch(StackActions.push("trail/[identifier]", { identifier: trail }));
    }, [trail, navigation]),
  );
}
