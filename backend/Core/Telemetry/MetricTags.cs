// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Telemetry;

/// <summary>
/// The bounded attribute vocabulary for the application meter.
///
/// METRICS ARE RETAINED FOR 730 DAYS, and that window is only lawful because they carry no
/// personal data at all (docs/observability.md). So the rule is absolute: if the set of values an
/// attribute can take is not enumerable at compile time, it does not go on a metric. No entity
/// Identifier, no free text, no per-user value — those are unbounded cardinality, which is both a
/// disk problem and, almost always, a personal identifier wearing a different name.
///
/// <see cref="Keys"/> is the half that matters legally: attribute keys become stream SCHEMA FIELD
/// NAMES, and those are what scripts/observatory-retention.sh scans. It splits each field name on
/// [^a-z0-9]+ and warns if any token lands in its identifier set — and a warning there is a
/// release blocker, not a cleanup task.
///
/// The trap is that the script cannot tell a trail from a person. "name" is in its token set, so
/// `trail_name` warns even though a trail is not a person; `mail_status` warns on `mail`;
/// `subject` warns regardless of meaning (an email subject line is not a Keycloak subject id).
/// Every such name is therefore forbidden here too, and MetricAttributeVocabularyTests turns that
/// from a post-deploy shell warning nobody reads into a red build.
///
/// See docs/notes/metric-attribute-names-trip-the-retention-guard.md for the full token set,
/// the names that pass despite looking like they should not, and why widening the guard is the
/// wrong fix.
/// </summary>
public static class MetricTags
{
    /// <summary>
    /// Attribute keys. These become stream schema field names — see the class remarks before
    /// adding one, and prefer no dimension at all to a borderline one.
    /// </summary>
    public static class Keys
    {
        /// <summary>How the operation ended. See <see cref="Values.OutcomeSuccess"/> and friends.</summary>
        public const string Outcome = "outcome";

        /// <summary>Which way the change went: add, remove or update.</summary>
        public const string Operation = "operation";

        /// <summary>Which of a user's two trail collections: favorites or wishlist.</summary>
        public const string List = "list";
    }

    /// <summary>
    /// Attribute values. Every one is a compile-time constant, which is what makes the
    /// cardinality of each dimension knowable by reading this file.
    /// </summary>
    public static class Values
    {
        public const string OutcomeSuccess = "success";
        public const string OutcomeNotFound = "not_found";
        public const string OutcomeConflict = "conflict";
        public const string OutcomeForbidden = "forbidden";
        public const string OutcomeRejected = "rejected";
        public const string OutcomeError = "error";

        public const string OperationAdd = "add";
        public const string OperationRemove = "remove";
        public const string OperationUpdate = "update";

        public const string ListFavorites = "favorites";
        public const string ListWishlist = "wishlist";
    }
}
