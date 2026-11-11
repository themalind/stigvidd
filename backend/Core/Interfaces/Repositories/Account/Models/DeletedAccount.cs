// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;

namespace Core.Interfaces.Repositories.Account.Models;

public sealed record DeletedAccount(int UserId, IReadOnlyCollection<string> FileUrls, IReadOnlyCollection<PushMessage> Pushes);
