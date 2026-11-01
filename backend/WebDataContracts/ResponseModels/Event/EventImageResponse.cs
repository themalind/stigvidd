// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

public class EventImageResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }
}
