// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories;

public sealed record EventsByStart(bool Descending = false, EventPageKey? After = null) : EventOrder;
