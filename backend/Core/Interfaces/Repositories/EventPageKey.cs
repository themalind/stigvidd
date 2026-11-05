// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories;

// At is StartsAt for events and CreatedAt for board posts. keep-comment: one cursor shape for both
public record EventPageKey(DateTime At, int Id);
