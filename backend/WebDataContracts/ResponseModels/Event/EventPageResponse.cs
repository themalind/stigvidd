// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventPageResponse
{
    public required IReadOnlyCollection<EventSummaryResponse> Items { get; set; }
    public string? NextCursor { get; set; }
}
