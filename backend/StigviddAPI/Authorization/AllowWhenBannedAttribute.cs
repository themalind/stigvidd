// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace StigviddAPI.Authorization;

/// <summary>
/// Lets a banned account through <see cref="BannedUserWriteFilter"/>. Carry it on a write that
/// reaches nobody but the caller -- their own log, their own lists, a deletion -- and on a read
/// that happens to be a POST. Everything else is refused, so a new endpoint is closed until
/// someone decides otherwise.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class AllowWhenBannedAttribute : Attribute;
