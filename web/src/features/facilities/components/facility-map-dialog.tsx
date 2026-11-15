// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { MapPin } from "lucide-react";
import type { AdminFacilityResponse } from "@/api/generated/model";
import { MapDialog } from "@/components/map-dialog";
import { Button } from "@/components/ui/button";
import { facilityTypeLabel } from "@/utils/facility-types";
import { FacilityMap, type MapNeighbour } from "./facility-map";

interface Props {
  facility: AdminFacilityResponse;
  neighbours: MapNeighbour[];
}

export function FacilityMapDialog({ facility, neighbours }: Props) {
  const { latitude, longitude } = facility;
  const placed = latitude !== null && longitude !== null;

  return (
    <MapDialog
      title={facility.name}
      description={
        <>
          {facilityTypeLabel(facility.facilityType)} at {latitude}, {longitude}. Grey dots are the other facilities.
        </>
      }
      trigger={
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Show ${facility.name} on map`}
          title={placed ? "Show on map" : "No position"}
          disabled={!placed}
        >
          <MapPin />
        </Button>
      }
    >
      {(satellite) => (
        <FacilityMap position={placed ? [longitude, latitude] : null} neighbours={neighbours} satellite={satellite} />
      )}
    </MapDialog>
  );
}
