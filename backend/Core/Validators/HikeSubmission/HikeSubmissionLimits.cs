// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Validators.HikeSubmission;

public static class HikeSubmissionLimits
{
    public const int Name = 80;
    public const int Description = 2000;
    public const int ShortText = 500;
    // keep-comment: copied into Trail.AccessibilityInfo on approval, so it shares UpdateTrailRequestValidator's limit
    public const int AccessibilityInfo = 200;
    // keep-comment: copied into Trail.City on approval, so it shares UpdateTrailRequestValidator's limit
    public const int City = 30;
    public const int Images = 10;
    // keep-comment: mirrored by MAX_PENDING_SUBMISSIONS in the app
    public const int PendingPerUser = 3;
}
