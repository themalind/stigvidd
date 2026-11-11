// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Hikes.Models;

// keep-comment: DiscardedImageUrls are copies whose hike photo was hidden by moderation; their files are the caller's to delete
public record ApprovedSubmission(string TrailIdentifier, IReadOnlyCollection<string> DiscardedImageUrls);
