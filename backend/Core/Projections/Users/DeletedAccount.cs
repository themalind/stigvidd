// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.Users;

public sealed record DeletedAccount(int UserId, IReadOnlyCollection<string> FileUrls);
