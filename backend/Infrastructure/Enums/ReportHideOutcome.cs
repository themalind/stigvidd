// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// What the report actually did to the content, which is not the same as its status: a
// report can be queued without hiding anything.
public enum ReportHideOutcome
{
    Hidden = 0,
    AlreadyHidden = 1,
    WithheldReporterDismissed = 2,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
