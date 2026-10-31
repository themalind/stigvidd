// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;

namespace Core.Interfaces.Repositories;

// What must happen after a moderation delete commits: files to clear and people to tell. keep-comment: handlers never send or delete files themselves
public sealed class ContentDeletionEffects
{
    public List<string> ImageUrls { get; } = [];
    public List<PushMessage> Pushes { get; } = [];
}
