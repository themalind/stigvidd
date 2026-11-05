// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace StigviddLinks;

public record Lookup<T>(LookupStatus Status, T? Value = null) where T : class;
