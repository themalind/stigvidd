// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { removeFromFavoritesAtom, userFavoritesAtom } from "@/atoms/user-atoms";
import ErrorView from "@/components/error-view";
import LoadingIndicator from "@/components/loading-indicator";
import UserTrailCollection from "@/components/user/user-trail-collection";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";

export default function FavoritesScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [{ data, isLoading, isError, error }] = useAtom(userFavoritesAtom);
  const [removeFromFavorite] = useAtom(removeFromFavoritesAtom);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <ErrorView error={error} />;
  }

  const handleDelete = (trailIdentifier: string) => {
    removeFromFavorite.mutate(trailIdentifier);
  };

  return (
    <UserTrailCollection
      title={t("collection.favorites.title")}
      noTrailsSavedInfo={t("collection.favorites.empty")}
      onDelete={handleDelete}
      trails={data ?? []}
      icon={<MaterialCommunityIcons name="cards-heart" size={24} color={theme.colors.tertiary} />}
    />
  );
}
