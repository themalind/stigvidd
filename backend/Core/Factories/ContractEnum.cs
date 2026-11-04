// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Factories;

// keep-comment: maps a database enum to its WebDataContracts twin by member name; ContractEnumTests pins that every name exists on both sides
public static class ContractEnum
{
    public static TContract ToContract<TContract>(this Enum value) where TContract : struct, Enum
    {
        return Enum.Parse<TContract>(value.ToString());
    }
}
