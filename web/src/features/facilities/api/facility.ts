// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAdminFacilitiesGetAllSuspenseQueryOptions } from "@/api/generated/admin-facilities/admin-facilities";

// The admin list, as the public one drops facilities without coordinates. keep-comment: two endpoints look interchangeable
export const facilitiesQueryOptions = () => getAdminFacilitiesGetAllSuspenseQueryOptions();
