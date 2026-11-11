// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Account.Models;

public enum AccountRegistrationOutcome
{
    Created,
    EmailTaken,
    NickNameTaken,
    Failed,
}
