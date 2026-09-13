// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Telemetry;
using System.Diagnostics.Metrics;

namespace UnitTests.Telemetry;

/// <summary>One measurement as it reached the listener.</summary>
internal sealed record RecordedMeasurement(
    string InstrumentName,
    double Value,
    IReadOnlyDictionary<string, string?> Tags);

/// <summary>
/// Captures what a <see cref="StigviddMetrics"/> actually recorded.
///
/// Hand-rolled rather than Microsoft.Extensions.Diagnostics.Testing's MetricCollector: that
/// package is not referenced anywhere in backend/ today, so adding it means a new dependency and
/// the .nuspec licence check the repo requires, for about forty lines of value.
///
/// Filters on the meter INSTANCE, not its name. Every StigviddMetrics is called "Stigvidd", and
/// xunit runs test classes in parallel, so a name filter would quietly mix one test's
/// measurements into another's — the kind of flake that only shows up under load.
/// </summary>
internal sealed class RecordedMetrics : IDisposable
{
    private readonly MeterListener _listener;
    private readonly List<RecordedMeasurement> _measurements = [];
    private readonly List<string> _published = [];
    private readonly Lock _gate = new();

    public RecordedMetrics(StigviddMetrics metrics)
    {
        var meter = metrics.Meter;

        _listener = new MeterListener
        {
            InstrumentPublished = (instrument, listener) =>
            {
                if (!ReferenceEquals(instrument.Meter, meter))
                {
                    return;
                }

                lock (_gate)
                {
                    _published.Add(instrument.Name);
                }

                listener.EnableMeasurementEvents(instrument);
            },
        };

        _listener.SetMeasurementEventCallback<long>(Record);
        _listener.SetMeasurementEventCallback<double>(Record);
        _listener.Start();
    }

    /// <summary>
    /// Every instrument the meter published, whether or not it was ever written to.
    ///
    /// Assert against this as well as against <see cref="Measurements"/>: a mistyped instrument
    /// name produces an EMPTY measurement list, which a "should be empty" assertion accepts
    /// happily. This is what tells "nothing was recorded" apart from "nothing exists".
    /// </summary>
    public IReadOnlyList<string> PublishedInstruments
    {
        get { lock (_gate) { return [.. _published]; } }
    }

    public IReadOnlyList<RecordedMeasurement> Measurements
    {
        get { lock (_gate) { return [.. _measurements]; } }
    }

    public IReadOnlyList<RecordedMeasurement> For(string instrumentName) =>
        [.. Measurements.Where(m => m.InstrumentName == instrumentName)];

    /// <summary>
    /// Polls every observable instrument once. Gauges are only read when the exporter collects,
    /// so without this a gauge test would be waiting on an export interval that never comes.
    /// </summary>
    public void RecordObservable() => _listener.RecordObservableInstruments();

    private void Record<T>(
        Instrument instrument,
        T measurement,
        ReadOnlySpan<KeyValuePair<string, object?>> tags,
        object? state)
        where T : struct
    {
        var captured = new Dictionary<string, string?>(tags.Length, StringComparer.Ordinal);

        foreach (var tag in tags)
        {
            captured[tag.Key] = tag.Value?.ToString();
        }

        lock (_gate)
        {
            _measurements.Add(new RecordedMeasurement(
                instrument.Name,
                Convert.ToDouble(measurement),
                captured));
        }
    }

    public void Dispose() => _listener.Dispose();
}
