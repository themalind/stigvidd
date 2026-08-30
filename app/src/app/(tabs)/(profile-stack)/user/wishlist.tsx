// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { removeFromWishlistAtom, userWishlistAtom } from "@/atoms/user-atoms";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";
import UserTrailCollection from "@/components/user/user-trail-collection";
import { MaterialIcons } from "@expo/vector-icons";
import { useAtom } from "jotai";
import { useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function WishlistScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [{ data, isLoading, isError, error }] = useAtom(userWishlistAtom);
  const [removeUserWishlist] = useAtom(removeFromWishlistAtom);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <ErrorView error={error} />;
  }

  const handleDelete = (trailIdentifier: string) => {
    removeUserWishlist.mutate(trailIdentifier);
  };

  return (
    <UserTrailCollection
      title={t("collection.wishlist.title")}
      noTrailsSavedInfo={t("collection.wishlist.empty")}
      onDelete={handleDelete}
      trails={data ?? []}
      icon={<MaterialIcons name="star" size={24} color={theme.colors.tertiary} />}
    />
  );
}
