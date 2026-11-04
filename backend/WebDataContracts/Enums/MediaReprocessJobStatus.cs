// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Json.Serialization;

namespace WebDataContracts.Enums;

// keep-comment: no database twin; MediaReprocessJobSummaryResponse derives it from the item counts
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MediaReprocessJobStatus
{
    Pending,
    Processing,
    Completed,
}
