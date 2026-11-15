// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useSuspenseQuery } from "@tanstack/react-query";
import { Page } from "@/components/page";
import { facilitiesQueryOptions } from "@/features/facilities/api/facility";
import { FacilityList } from "@/features/facilities/components/facility-list";

export default function FacilitiesPage() {
  const { data: facilities } = useSuspenseQuery(facilitiesQueryOptions());

  return (
    <Page width="full">
      <FacilityList facilities={facilities} />
    </Page>
  );
}
