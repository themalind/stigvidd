// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.MailOutbox;

/// <summary>
/// Deletes sent mail older than a cutoff. The only destructive operation on the outbox.
/// </summary>
/// <remarks>
/// Confirm is the machine-checkable half of the confirmation, and OlderThanDays has a floor of
/// 1 in its validator: zero is the JSON default for an omitted int, so without the floor a
/// client that simply forgot the field would empty the table and be told it succeeded.
/// </remarks>
public class PurgeMailOutboxRequest
{
    public int OlderThanDays { get; set; }

    public bool Confirm { get; set; }
}
