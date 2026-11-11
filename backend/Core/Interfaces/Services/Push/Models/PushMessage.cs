// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Push.Models;

/// <summary>Pass FromUserId when a person triggered this; anyone who blocked them is skipped.</summary> keep-comment: the block filter is invisible at the call site
public sealed record PushMessage(
    IReadOnlyCollection<int> UserIds,
    string Title,
    string Body,
    IReadOnlyDictionary<string, object> Data,
    int? FromUserId = null);
