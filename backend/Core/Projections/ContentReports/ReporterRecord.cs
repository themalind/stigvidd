// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.ContentReports;

// keep-comment: the withholding rule reads this, and the queue shows it next to the reporter
public record ReporterRecord(int Total, int Pending, int Dismissed, int Upheld);
