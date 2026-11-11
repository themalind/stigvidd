// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

public class EventPostsReadRequest
{
    // The CreatedAt of the newest post the app has shown; the marker only moves forward. keep-comment: never the device clock
    public DateTime ReadUpTo { get; set; }
}
