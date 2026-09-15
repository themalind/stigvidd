// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Telemetry;

/// <summary>
/// Maps the two ways this codebase reports how an operation ended onto the bounded
/// <c>outcome</c> vocabulary in <see cref="MetricTags.Values"/>.
///
/// Centralised so the dimension stays bounded by construction. Mapping at each call site is how
/// a metric quietly acquires a sixth, seventh and eighth outcome value that no dashboard expects
/// and no one notices until the cardinality bill arrives.
/// </summary>
public static class MetricOutcome
{
    public static string From(RepositoryResultStatus status) => status switch
    {
        RepositoryResultStatus.Success => MetricTags.Values.OutcomeSuccess,
        RepositoryResultStatus.NotFound => MetricTags.Values.OutcomeNotFound,
        RepositoryResultStatus.Conflict => MetricTags.Values.OutcomeConflict,
        _ => MetricTags.Values.OutcomeError,
    };

    /// <summary>
    /// Derives the outcome from the HTTP status a failed <see cref="Result"/> carries.
    ///
    /// Reading the finished Result rather than tagging each early return is deliberate: a method
    /// with seven exit points gets exactly one measurement per call, and an eighth exit added
    /// later is counted without anyone remembering to instrument it.
    /// </summary>
    public static string From(Result result)
    {
        if (result.Success)
        {
            return MetricTags.Values.OutcomeSuccess;
        }

        return result.Message?.StatusCode switch
        {
            404 => MetricTags.Values.OutcomeNotFound,
            409 => MetricTags.Values.OutcomeConflict,
            // A 400 is the caller sending something invalid; a 403 is the caller not being
            // allowed to. Collapsing them would hide a broken client behind a permissions story.
            400 => MetricTags.Values.OutcomeRejected,
            403 => MetricTags.Values.OutcomeForbidden,
            _ => MetricTags.Values.OutcomeError,
        };
    }
}
