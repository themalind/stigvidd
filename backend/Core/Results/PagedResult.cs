// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.ComponentModel.DataAnnotations;

namespace Core.Results;

// keep-comment: [Required] only marks the OpenAPI schema (the generated client's types); System.Text.Json ignores it
public record PagedResult<T>(
    [property: Required] IReadOnlyCollection<T> Items,
    [property: Required] int Page,
    [property: Required] bool HasMore,
    [property: Required] int TotalCount);
