// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Media;

public class MediaFilter
{
    public string? OwnerType { get; set; }
    public string? OwnerIdentifier { get; set; }
    public string? Format { get; set; }

    public int? MinWidth { get; set; }
    public int? MaxWidth { get; set; }
    public int? MinHeight { get; set; }
    public int? MaxHeight { get; set; }
    public long? MinSizeBytes { get; set; }
    public long? MaxSizeBytes { get; set; }
    public DateTime? CreatedFrom { get; set; }

    // keep-comment: exclusive, so a caller can pass the day after the one the operator picked and keep every image uploaded on that day
    public DateTime? CreatedTo { get; set; }

    // keep-comment: these two are an OR pair with each other and AND with everything else - they select what a reprocess to that target would change. Quality is not stored, so an already-compact image re-encoded at a lower quality still shrinks and is still not matched here.
    public int? TargetMaxWidth { get; set; }
    public string? TargetFormat { get; set; }
}
