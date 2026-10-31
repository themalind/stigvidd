// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

// The route is the one field an omission keeps: a copy cannot be sent back. HikeIdentifier replaces it, RemoveRoute or a TrailIdentifier clears it. keep-comment: differs from every other field of this PUT
public class UpdateEventRequest : EventRequest
{
    public bool RemoveRoute { get; set; }
}
