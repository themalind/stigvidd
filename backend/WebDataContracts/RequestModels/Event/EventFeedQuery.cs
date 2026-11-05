// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

public class EventFeedQuery : EventSearchQuery
{
    public string? Trail { get; set; }
    public string? Organizer { get; set; }

    // Leaves out events the signed-in viewer is part of, which the app lists under Mina. keep-comment: what the flag drops
    public bool ExcludeMine { get; set; }
}
