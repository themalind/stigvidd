// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Telemetry;
using System.Reflection;
using System.Text.RegularExpressions;

namespace UnitTests.Telemetry;

/// <summary>
/// Keeps the metric attribute vocabulary inside what the GDPR guard in
/// scripts/observatory-retention.sh will accept.
///
/// WHY THIS IS A TEST AND NOT A REVIEW CONVENTION: metrics are retained for 730 days, which is
/// only lawful while they carry no personal data (docs/observability.md). The script enforces
/// that by scanning every metrics stream's schema and warning on identifier-shaped field names —
/// but it runs ON THE HOST, AFTER DEPLOY, and prints a warning nobody reads until release. By
/// then the stream exists and the two-year clock has started. This moves the same check to the
/// build, where it is free.
///
/// The tokenisation is the part that catches people out. The script cannot tell a trail from a
/// person: "name" is in its token set, so `trail_name` warns; `mail_status` warns on `mail`;
/// `subject` warns whether it means a Keycloak subject id or an email subject line. All of them
/// are forbidden here for that reason alone.
///
/// See docs/notes/metric-attribute-names-trip-the-retention-guard.md.
/// </summary>
public class MetricAttributeVocabularyTests
{
    // Copied VERBATIM from IDENT_TOKENS in scripts/observatory-retention.sh. If that set ever
    // changes, change it here too — these are two halves of one rule, and nothing but this
    // comment ties them together.
    private static readonly HashSet<string> IdentifierTokens = new(StringComparer.Ordinal)
    {
        "user", "userid", "uid", "sub", "subject", "session", "sessionid",
        "email", "mail", "ip", "clientip", "remoteaddr", "device", "deviceid",
        "token", "lat", "latitude", "lon", "lng", "longitude", "coord",
        "coords", "coordinate", "coordinates", "geo", "phone", "name",
    };

    public static TheoryData<string, string> AttributeKeys()
    {
        var data = new TheoryData<string, string>();

        foreach (var field in ConstantsOf(typeof(MetricTags.Keys)))
        {
            data.Add(field.Name, (string)field.GetRawConstantValue()!);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(AttributeKeys))]
    public void EveryAttributeKey_TokenisesClearOfTheRetentionScriptsIdentifierSet(string fieldName, string key)
    {
        var offending = Tokenise(key).Where(IdentifierTokens.Contains).ToArray();

        offending.Should().BeEmpty(
            "MetricTags.Keys.{0} = \"{1}\" tokenises into {2}, which scripts/observatory-retention.sh "
            + "flags as personal data on a 730-day stream. Rename it — see the traps in "
            + "docs/observability.md (trail_name -> no dimension, mail_status -> delivery_status).",
            fieldName,
            key,
            string.Join(", ", offending));
    }

    [Fact]
    public void AttributeKeysAreLowerSnakeCase_SoTheyTokeniseTheWayTheScriptExpects()
    {
        var keys = ConstantsOf(typeof(MetricTags.Keys))
            .Select(f => (string)f.GetRawConstantValue()!);

        keys.Should().AllSatisfy(key =>
            Regex.IsMatch(key, "^[a-z0-9]+(_[a-z0-9]+)*$").Should().BeTrue(
                "\"{0}\" must be lower_snake_case: the guard lowercases and splits on [^a-z0-9]+, "
                + "so a camelCase key hides a token from it", key));
    }

    [Fact]
    public void ThereIsAtLeastOneAttributeKey_SoAnEmptyVocabularyCannotPassVacuously()
    {
        // Without this, deleting every const in MetricTags.Keys turns the theory above into zero
        // test cases and the suite stays green while the vocabulary is gone.
        ConstantsOf(typeof(MetricTags.Keys)).Should().NotBeEmpty();
    }

    private static FieldInfo[] ConstantsOf(Type type) =>
        [.. type.GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy)
            .Where(f => f is { IsLiteral: true, IsInitOnly: false } && f.FieldType == typeof(string))];

    private static IEnumerable<string> Tokenise(string value) =>
        Regex.Split(value.ToLowerInvariant(), "[^a-z0-9]+").Where(t => t.Length > 0);
}
