// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events.Models;

// Pinned is empty unless asked for; Posts is oldest first. keep-comment: the page order the app renders
public sealed record EventBoardPage(IReadOnlyList<EventPostRow> Pinned, IReadOnlyList<EventPostRow> Posts, bool HasMore, DateTime? LastReadPostAt, bool Muted);
