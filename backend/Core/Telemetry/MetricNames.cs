// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Telemetry;

/// <summary>
/// Instrument names for the application meter.
///
/// <see cref="MeterName"/> is an UNCHECKED STRING in two places, exactly like the "AdminOnly"
/// policy name: here, and in the <c>AddMeter(...)</c> call in StigviddAPI's TelemetryExtensions.
/// If the two ever differ the instruments still record, the exporter simply never subscribes,
/// and the metric silently never leaves the process. Sharing this one const is the whole reason
/// the class exists — never type the literal at either site.
///
/// Naming: lowercase, dot-separated, prefixed `stigvidd.` so our streams are unambiguously ours
/// among the ~70 AspNetCore/HttpClient/Runtime/Npgsql ones. The UNIT belongs in the instrument's
/// unit parameter, not in the name. Counters name the event in the past tense; histograms name
/// the quantity being measured.
///
/// Adding a name here obliges re-running scripts/observatory-retention.sh on the host after
/// deploy: a metrics stream is created on first ingest and inherits the 7-DAY global retention
/// until that script raises it. See docs/observability.md.
/// </summary>
public static class MetricNames
{
    public const string MeterName = "Stigvidd";

    /// <summary>A trail was added to or removed from a user's favourites or wish list.</summary>
    public const string TrailFavoritesChanged = "stigvidd.trail.favorites.changed";

    /// <summary>A review was written or deleted.</summary>
    public const string ReviewCreated = "stigvidd.review.created";

    /// <summary>The star rating carried by a review. A MEASUREMENT, never an attribute.</summary>
    public const string ReviewRating = "stigvidd.review.rating";
}
