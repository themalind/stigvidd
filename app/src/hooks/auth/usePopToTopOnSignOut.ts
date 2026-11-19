// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useAuth } from "@/components/auth/auth-provider";
import { useNavigation } from "expo-router";
import { StackActions } from "expo-router/react-navigation";
import { useEffect, useRef } from "react";

// Pops this screen's stack to its first screen when the user signs out while it is open. keep-comment: a deep link opened signed out keeps its prompt
export function usePopToTopOnSignOut() {
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const wasAuthenticated = useRef(isAuthenticated);

  useEffect(() => {
    const signedOut = wasAuthenticated.current && !isAuthenticated;
    wasAuthenticated.current = isAuthenticated;
    if (!signedOut) return;
    const index = navigation.getState()?.index ?? 0;
    if (index > 0) navigation.dispatch(StackActions.popToTop());
  }, [isAuthenticated, navigation]);
}
