// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Event;

// Visibility is set here and never again; UpdateEventRequest has no such field. keep-comment: an event cannot change between open and private
public class CreateEventRequest : EventRequest
{
    public required string Visibility { get; set; }
    public Guid? ClientRequestId { get; set; }
}
