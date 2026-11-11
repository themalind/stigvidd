// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.DomainEvents;

internal sealed record HandlerRun(IReadOnlyList<string> Completed, IReadOnlyList<string> Errors, bool Interrupted = false);
