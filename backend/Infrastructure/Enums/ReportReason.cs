// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// Why the reporter says the content should go.
public enum ReportReason
{
    Other = 0,
    Offensive = 1,
    Spam = 2,
    PersonalData = 3,
    Misinformation = 4,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
