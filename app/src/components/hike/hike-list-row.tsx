// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import RouteThumbnail from "@/components/hike/route-thumbnail";
import ImageThumbnail from "@/components/image-thumbnail";
import MediaListRow from "@/components/media-list-row";
import { formatDate } from "@/utils/format-date";
import FormattedTime from "@/utils/format-time-from-ms";
import { useTheme } from "react-native-paper";

interface Props {
  identifier: string;
  name: string;
  coordinates: string;
  imageUrl?: string | null;
  hikeLength: number;
  duration: number;
  date: string;
  caption?: string;
  onPress: () => void;
  testID?: string;
}

export default function HikeListRow({
  identifier,
  name,
  coordinates,
  imageUrl,
  hikeLength,
  duration,
  date,
  caption,
  onPress,
  testID,
}: Props) {
  const theme = useTheme();

  return (
    <MediaListRow
      testID={testID}
      thumbnail={
        imageUrl ? (
          <ImageThumbnail testID="hike-row-image" uri={imageUrl} />
        ) : (
          <RouteThumbnail
            coordinates={coordinates}
            identifier={identifier}
            background={theme.colors.surfaceVariant}
            stroke={theme.colors.onSurfaceVariant}
          />
        )
      }
      title={name}
      meta={[`${hikeLength} km`, FormattedTime(duration)]}
      caption={caption}
      trailing={formatDate(date)}
      onPress={onPress}
    />
  );
}
