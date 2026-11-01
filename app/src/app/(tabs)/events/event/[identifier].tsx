// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import EventDetailsScreen from "@/components/event/event-details-screen";
import { EVENTS_TAB_ROUTES } from "@/components/event/event-routes";

export default function EventScreen() {
  return <EventDetailsScreen routes={EVENTS_TAB_ROUTES} />;
}
