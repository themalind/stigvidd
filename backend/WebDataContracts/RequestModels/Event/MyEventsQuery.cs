// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

public class MyEventsQuery
{
    public bool Past { get; set; }
    public int Limit { get; set; } = EventFeedQuery.DefaultLimit;
    public string? Cursor { get; set; }
}
