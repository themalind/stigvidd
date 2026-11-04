// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.Json.Serialization;

namespace WebDataContracts.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MatchConfidence
{
    Unmatched,
    Medium,
    High,
    Certain,
}
