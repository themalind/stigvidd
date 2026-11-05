// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace UnitTests.Telemetry;

internal sealed record RecordedMeasurement(
    string InstrumentName,
    double Value,
    IReadOnlyDictionary<string, string?> Tags);
