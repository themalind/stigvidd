// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// keep-comment: always its own copy, never the hike's file (hike photos are deleted without a reference check)
public class HikeSubmissionImage : BaseEntity
{
    public int HikeSubmissionId { get; set; }
    public HikeSubmission? HikeSubmission { get; set; }
    // keep-comment: lets moderation of the hike photo reach the copy; null once the hike photo is deleted
    public int? SourceHikeImageId { get; set; }
    public HikeImage? SourceHikeImage { get; set; }
    public required string ImageUrl { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public long SizeBytes { get; set; }
    public int SortOrder { get; set; }
}
