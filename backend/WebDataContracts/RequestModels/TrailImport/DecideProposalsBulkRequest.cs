// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.ComponentModel.DataAnnotations;

namespace WebDataContracts.RequestModels.TrailImport;

// The same decision applied to a batch, which is how the 177 certain matches get through
// the review in one action.
public class DecideProposalsBulkRequest
{
    [Required]
    [MinLength(1)]
    public required IReadOnlyCollection<int> ProposalIds { get; set; }

    [Required]
    public required string Decision { get; set; }

    public string? Role { get; set; }

    [MaxLength(2000)]
    public string? Note { get; set; }
}
