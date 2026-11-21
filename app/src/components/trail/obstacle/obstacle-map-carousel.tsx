// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import MapCardCarousel, { type CarouselCardLayout } from "@/components/map/map-card-carousel";
import { SCREEN_PADDING } from "@/constants/constants";
import { TrailObstacle } from "@/data/types";
import { useCallback } from "react";
import ObstacleMapCard from "./obstacle-map-card";

interface Props {
  obstacles: readonly TrailObstacle[];
  // keep-comment: the tap that opened it (see MapCardCarousel)
  opening: unknown;
  trailIdentifier: string;
  onClose: () => void;
  onActiveChange: (identifier: string) => void;
  onMeasure: (coveredHeight: number) => void;
}

function identifierOf(obstacle: TrailObstacle) {
  return obstacle.identifier;
}

export default function ObstacleMapCarousel({
  obstacles,
  opening,
  trailIdentifier,
  onClose,
  onActiveChange,
  onMeasure,
}: Props) {
  const renderCard = useCallback(
    (obstacle: TrailObstacle, { width }: CarouselCardLayout) => (
      <ObstacleMapCard obstacle={obstacle} trailIdentifier={trailIdentifier} width={width} />
    ),
    [trailIdentifier],
  );

  return (
    <MapCardCarousel
      testID="obstacle-carousel"
      items={obstacles}
      opening={opening}
      keyOf={identifierOf}
      renderCard={renderCard}
      onClose={onClose}
      onActiveChange={onActiveChange}
      onMeasure={onMeasure}
      bottomOffset={SCREEN_PADDING}
    />
  );
}
