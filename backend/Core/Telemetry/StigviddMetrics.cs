// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Diagnostics.Metrics;

namespace Core.Telemetry;

/// <summary>
/// The application's own instruments.
///
/// THIS TYPE REGISTERS NOTHING WITH OPENTELEMETRY. <see cref="Meter"/> and its instruments are
/// BCL types from System.Diagnostics.DiagnosticSource, which ships in the framework — creating
/// them starts no thread, opens no socket and needs no package. With no listener attached,
/// recording a measurement is a branch on a bool. That is what lets this be registered
/// unconditionally in Core while EXPORT stays strictly opt-in in StigviddAPI's
/// TelemetryExtensions, which registers no providers at all unless Otlp:Endpoint is set.
///
/// Registered as a SINGLETON, and that is mandatory rather than a preference: a Meter owns its
/// instruments, so constructing one per request leaks.
///
/// Built from <see cref="IMeterFactory"/> rather than a static Meter because the integration
/// suite boots many hosts in one process. A process-wide static meter would let one host's
/// instruments reach a MeterListener started by another host's test, and the measurements would
/// interleave. A factory-made meter is owned by that host's container and dies with it.
///
/// The instruments are PRIVATE and reached through the Record* methods on purpose. Attribute
/// vocabulary is the GDPR-load-bearing part of a metric (docs/observability.md: a 730-day stream
/// must carry no personal data), so it is not left to each call site to assemble. A caller
/// chooses from <see cref="MetricTags.Values"/>; it cannot invent a dimension.
/// </summary>
public sealed class StigviddMetrics : IDisposable
{
    private readonly Meter _meter;

    // Whether this instance created the Meter and must therefore dispose it. False on the
    // production path, where IMeterFactory owns the meter and the container disposes it.
    private readonly bool _ownsMeter;

    private readonly Counter<long> _trailFavoritesChanged;
    private readonly Counter<long> _reviewCreated;
    private readonly Histogram<double> _reviewRating;

    public StigviddMetrics(IMeterFactory meterFactory)
        : this(meterFactory.Create(MetricNames.MeterName), ownsMeter: false)
    {
    }

    /// <summary>
    /// For unit tests, which construct services directly rather than resolving them. Deliberately
    /// NOT a null-tolerant overload of the public constructor: an <c>IMeterFactory?</c> parameter
    /// that quietly falls back is exactly how the production path loses its factory and stops
    /// exporting, with nothing failing to say so.
    /// </summary>
    internal StigviddMetrics()
        : this(new Meter(MetricNames.MeterName), ownsMeter: true)
    {
    }

    private StigviddMetrics(Meter meter, bool ownsMeter)
    {
        _meter = meter;
        _ownsMeter = ownsMeter;

        _trailFavoritesChanged = _meter.CreateCounter<long>(
            MetricNames.TrailFavoritesChanged,
            unit: "{change}",
            description: "Trails added to or removed from a user's favourites or wish list.");

        _reviewCreated = _meter.CreateCounter<long>(
            MetricNames.ReviewCreated,
            unit: "{review}",
            description: "Reviews written or deleted.");

        _reviewRating = _meter.CreateHistogram<double>(
            MetricNames.ReviewRating,
            unit: "{star}",
            description: "The star rating carried by a written review.");
    }

    /// <summary>
    /// The meter these instruments belong to. Exposed to the unit tests so a MeterListener can
    /// filter on this exact INSTANCE rather than on the meter name: xunit runs test classes in
    /// parallel, and every StigviddMetrics shares the name "Stigvidd", so a name filter would
    /// let one test's measurements land in another test's recorder.
    /// </summary>
    internal Meter Meter => _meter;

    /// <summary>
    /// A trail moved in or out of one of a user's two collections.
    ///
    /// Takes no trail and no user, and that is the point: which trail a given person saved is a
    /// location inference about that person, and this lands in a stream kept for two years.
    /// </summary>
    public void RecordCollectionChange(string list, string operation, string outcome) =>
        _trailFavoritesChanged.Add(
            1,
            new KeyValuePair<string, object?>(MetricTags.Keys.List, list),
            new KeyValuePair<string, object?>(MetricTags.Keys.Operation, operation),
            new KeyValuePair<string, object?>(MetricTags.Keys.Outcome, outcome));

    /// <summary>A review was written or deleted.</summary>
    public void RecordReviewChange(string operation, string outcome) =>
        _reviewCreated.Add(
            1,
            new KeyValuePair<string, object?>(MetricTags.Keys.Operation, operation),
            new KeyValuePair<string, object?>(MetricTags.Keys.Outcome, outcome));

    /// <summary>
    /// The rating a written review carried. Recorded only on success, and only as a
    /// MEASUREMENT — a rating as an attribute would be a five-way split of every other
    /// dimension for no gain.
    /// </summary>
    public void RecordReviewRating(decimal rating) => _reviewRating.Record((double)rating);

    public void Dispose()
    {
        if (_ownsMeter)
        {
            _meter.Dispose();
        }
    }
}
