// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Globalization;
using System.Text;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using WebDataContracts.Enums;

namespace Core.Services.Facilities;

// keep-comment: a field the source changed since the last import is taken, even over a local edit; the name is always ours
public static class FacilityImportPlanner
{
    public const double SuggestionRadiusMetres = 5_000;

    private static readonly string[] NameNoise =
        ["kommunala", "badplatsen", "badplats", "grillplatsen", "grillplats", "vindskyddet", "vindskydd"];

    // keep-comment: matchOnPosition is for files without a stable id; their sites carry position ids until matched
    public static Result<FacilityImportPlan> Plan(
        string sourceName,
        IReadOnlyCollection<SourceFacility> sourceFacilities,
        IReadOnlyCollection<Facility> facilities,
        IReadOnlyCollection<FacilityImportLink> links,
        IReadOnlyCollection<FacilityImportKeep> kept,
        bool matchOnPosition)
    {
        var prefix = sourceName + ":";
        var keep = kept.Select(k => (k.SourceId, k.Field)).ToHashSet();
        var importedTypes = sourceFacilities.Aggregate(FacilityType.None, (types, site) => types | site.Type);
        var bySourceId = new Dictionary<string, Facility>(StringComparer.Ordinal);
        var unlinked = new List<Facility>();

        foreach (var facility in facilities)
        {
            if (facility.SourceId is { } sourceId)
            {
                if (sourceId.StartsWith(prefix, StringComparison.Ordinal))
                    bySourceId[sourceId] = facility;
            }
            else if ((facility.FacilityType & importedTypes) != 0)
            {
                unlinked.Add(facility);
            }
        }

        // keep-comment: FacilityFileReader refuses a file whose ids repeat, so each site id is unique here
        var sites = matchOnPosition
            ? PositionMatcher.Match(sourceFacilities, bySourceId)
            : sourceFacilities.ToList();

        var linkResult = ResolveLinks(links, sites, bySourceId, unlinked);

        if (!linkResult.Success || linkResult.Value is not { } choices)
            return Result.Fail<FacilityImportPlan>(linkResult.Message ?? new Message(400, "Invalid links."));

        var suggestions = Suggest(sites.Where(s => !bySourceId.ContainsKey(s.SourceId)).ToList(), unlinked);
        var targets = Targets(sites, bySourceId, choices, suggestions);

        var unlinkedReferences = unlinked
            .OrderBy(f => f.Name)
            .Select(Reference)
            .ToList();
        var referenceById = unlinkedReferences.ToDictionary(r => r.Identifier, StringComparer.Ordinal);

        var rows = new List<FacilityImportRow>();
        var creates = new List<Facility>();
        var updates = new List<Facility>();
        int linked = 0, updated = 0, unchanged = 0;

        foreach (var site in sites)
        {
            var theirs = FacilitySourceSnapshot.From(site);

            if (bySourceId.TryGetValue(site.SourceId, out var existing))
            {
                var existingReference = Reference(existing);
                var baseline = FacilitySourceSnapshot.Parse(existing.SourceSnapshot);
                var changes = Merge(existing, baseline, theirs, site, keep);
                var snapshot = theirs.ToJson();

                if (changes.Count > 0 || existing.SourceSnapshot != snapshot)
                {
                    existing.SourceSnapshot = snapshot;
                    updates.Add(existing);
                }

                // keep-comment: a row whose every change is kept stays Changed, so the choice can be undone, but writes nothing of ours
                if (changes.Any(c => !c.Kept))
                    updated++;
                else
                    unchanged++;

                var kind = changes.Count > 0 ? FacilityImportRowKind.Changed : FacilityImportRowKind.Unchanged;
                rows.Add(new FacilityImportRow(site.SourceId, site.Name, kind, site.Type, existingReference, null, changes));
                continue;
            }

            suggestions.TryGetValue(site.SourceId, out var suggested);
            var suggestedReference = suggested is null ? null : referenceById[suggested.Identifier];

            if (targets.TryGetValue(site.SourceId, out var target))
            {
                var targetReference = referenceById[target.Identifier];
                var changes = Merge(target, null, theirs, site, keep);
                target.SourceId = site.SourceId;
                target.SourceSnapshot = theirs.ToJson();
                target.FacilityType |= site.Type;
                updates.Add(target);
                linked++;

                rows.Add(new FacilityImportRow(site.SourceId, site.Name, FacilityImportRowKind.New, site.Type, targetReference, suggestedReference, changes));
                continue;
            }

            creates.Add(new Facility
            {
                Name = site.Name,
                Description = site.Description,
                Url = site.Url,
                Coordinates = GeoPointFactory.FromLonLat(site.Longitude, site.Latitude),
                FacilityType = site.Type,
                SourceId = site.SourceId,
                SourceSnapshot = theirs.ToJson(),
            });

            rows.Add(new FacilityImportRow(site.SourceId, site.Name, FacilityImportRowKind.New, site.Type, null, suggestedReference, NewRowChanges(theirs)));
        }

        var siteIds = sites.Select(s => s.SourceId).ToHashSet(StringComparer.Ordinal);
        var missing = bySourceId
            .Where(pair => !siteIds.Contains(pair.Key))
            .OrderBy(pair => pair.Value.Name)
            .ToList();

        foreach (var (sourceId, facility) in missing)
            rows.Add(new FacilityImportRow(sourceId, facility.Name, FacilityImportRowKind.Missing, facility.FacilityType, Reference(facility), null, []));

        var counts = new FacilityImportCounts(creates.Count, linked, updated, unchanged, missing.Count);

        return Result.Ok(new FacilityImportPlan(rows, unlinkedReferences, creates, updates, counts));
    }

    // keep-comment: maps each chosen source id to its facility, or to null for "create a new one"
    private static Result<Dictionary<string, Facility?>> ResolveLinks(
        IReadOnlyCollection<FacilityImportLink> links,
        IReadOnlyCollection<SourceFacility> sites,
        Dictionary<string, Facility> bySourceId,
        IReadOnlyCollection<Facility> unlinked)
    {
        var siteIds = sites.Select(s => s.SourceId).ToHashSet(StringComparer.Ordinal);
        var unlinkedById = unlinked.ToDictionary(f => f.Identifier, StringComparer.Ordinal);
        var choices = new Dictionary<string, Facility?>(StringComparer.Ordinal);
        var usedFacilities = new HashSet<string>(StringComparer.Ordinal);

        foreach (var link in links)
        {
            if (!siteIds.Contains(link.SourceId) || bySourceId.ContainsKey(link.SourceId))
                return Result.Fail<Dictionary<string, Facility?>>(new Message(400, $"'{link.SourceId}' is not a new facility in this import."));

            Facility? facility = null;

            if (link.FacilityIdentifier is { } identifier && !unlinkedById.TryGetValue(identifier, out facility))
                return Result.Fail<Dictionary<string, Facility?>>(new Message(400, $"'{identifier}' is not a facility that can be linked."));

            if (!choices.TryAdd(link.SourceId, facility) || (facility is not null && !usedFacilities.Add(facility.Identifier)))
                return Result.Fail<Dictionary<string, Facility?>>(new Message(400, "Each source facility and each facility can be linked only once."));
        }

        return Result.Ok(choices);
    }

    // keep-comment: an explicit choice wins; a row without one takes its suggestion unless a choice already took that facility
    private static Dictionary<string, Facility> Targets(
        IReadOnlyCollection<SourceFacility> sites,
        Dictionary<string, Facility> bySourceId,
        Dictionary<string, Facility?> choices,
        Dictionary<string, Facility> suggestions)
    {
        var targets = new Dictionary<string, Facility>(StringComparer.Ordinal);
        var chosen = choices.Values.OfType<Facility>().Select(f => f.Identifier).ToHashSet(StringComparer.Ordinal);

        foreach (var site in sites.Where(s => !bySourceId.ContainsKey(s.SourceId)))
        {
            if (choices.TryGetValue(site.SourceId, out var choice))
            {
                if (choice is not null)
                    targets[site.SourceId] = choice;
            }
            else if (suggestions.TryGetValue(site.SourceId, out var suggested) && !chosen.Contains(suggested.Identifier))
            {
                targets[site.SourceId] = suggested;
            }
        }

        return targets;
    }

    // keep-comment: a hand-entered twin is matched by a URL unique on both sides first, then by name without "badplats"
    private static Dictionary<string, Facility> Suggest(IReadOnlyCollection<SourceFacility> open, IReadOnlyCollection<Facility> unlinked)
    {
        var used = new HashSet<string>(StringComparer.Ordinal);
        var suggestions = new Dictionary<string, Facility>(StringComparer.Ordinal);

        var siteUrlCounts = CountUrls(open.Select(s => s.Url));
        var facilityUrlCounts = CountUrls(unlinked.Select(f => f.Url));

        foreach (var site in open)
        {
            if (NormalizeUrl(site.Url) is not { } url || siteUrlCounts[url] != 1 || facilityUrlCounts.GetValueOrDefault(url) != 1)
                continue;

            var match = unlinked.FirstOrDefault(f => NormalizeUrl(f.Url) == url && !used.Contains(f.Identifier) && Fits(site, f));

            if (match is not null)
            {
                suggestions[site.SourceId] = match;
                used.Add(match.Identifier);
            }
        }

        var facilityNames = unlinked.Select(f => (Facility: f, Name: NormalizeName(f.Name))).ToList();

        foreach (var site in open.Where(s => !suggestions.ContainsKey(s.SourceId)))
        {
            var name = NormalizeName(site.Name);

            if (name.Length == 0)
                continue;

            var match = facilityNames
                .Where(f => !used.Contains(f.Facility.Identifier) && f.Name == name && Fits(site, f.Facility))
                .Select(f => f.Facility)
                .FirstOrDefault();

            if (match is not null)
            {
                suggestions[site.SourceId] = match;
                used.Add(match.Identifier);
            }
        }

        return suggestions;
    }

    // keep-comment: a twin shares a type; one without a position (hand-typed from the municipality's website) can still match by name or URL
    private static bool Fits(SourceFacility site, Facility facility)
    {
        if ((facility.FacilityType & site.Type) == 0)
            return false;

        if (facility.Coordinates is not { } point)
            return true;

        return GeoDistance.Metres(site.Longitude, site.Latitude, point.X, point.Y) <= SuggestionRadiusMetres;
    }

    private static List<FacilityImportFieldChange> Merge(
        Facility facility,
        FacilitySourceSnapshot? baseline,
        FacilitySourceSnapshot theirs,
        SourceFacility site,
        HashSet<(string SourceId, FacilityImportField Field)> keep)
    {
        var changes = new List<FacilityImportFieldChange>();
        var hasBaseline = baseline is not null;
        var ourCoordinates = facility.Coordinates is { } point
            ? FacilitySourceSnapshot.FormatCoordinates(point.X, point.Y)
            : null;

        bool Take(FacilityImportField field, string? baselineValue, string? ours, string? theirsValue)
        {
            return MergeField(changes, field, baselineValue, ours, theirsValue, hasBaseline, keep.Contains((site.SourceId, field)));
        }

        if (Take(FacilityImportField.Description, baseline?.Description, facility.Description, theirs.Description))
            facility.Description = theirs.Description;

        if (Take(FacilityImportField.Url, baseline?.Url, facility.Url, theirs.Url))
            facility.Url = theirs.Url;

        if (Take(FacilityImportField.Coordinates, baseline?.Coordinates, ourCoordinates, theirs.Coordinates))
            facility.Coordinates = GeoPointFactory.FromLonLat(site.Longitude, site.Latitude);

        MergeType(changes, facility, baseline?.Type, site, keep.Contains((site.SourceId, FacilityImportField.Type)));

        return changes;
    }

    // keep-comment: a type the source changed replaces the type it gave last time; any type added here stays
    private static void MergeType(
        List<FacilityImportFieldChange> changes, Facility facility, FacilityType? baseline, SourceFacility site, bool kept)
    {
        if (baseline is not { } previous || previous == site.Type)
            return;

        var ours = facility.FacilityType;
        var merged = (ours & ~previous) | site.Type;

        if (merged == ours)
            return;

        changes.Add(new FacilityImportFieldChange(
            FacilityImportField.Type, TypeText(ours), TypeText(merged), OverwritesLocalEdit: ours != previous, kept));

        if (!kept)
            facility.FacilityType = merged;
    }

    private static string TypeText(FacilityType type)
    {
        return ((int)type).ToString(CultureInfo.InvariantCulture);
    }

    // keep-comment: true when the field takes the source's value; a kept change is listed but leaves ours in place
    private static bool MergeField(
        List<FacilityImportFieldChange> changes,
        FacilityImportField field,
        string? baseline,
        string? ours,
        string? theirs,
        bool hasBaseline,
        bool kept)
    {
        if (ours == theirs)
            return false;

        // keep-comment: linking never empties a field we filled; the source has nothing to replace it with
        if (!hasBaseline && theirs is null)
            return false;

        if (hasBaseline && baseline == theirs)
            return false;

        // keep-comment: without a baseline every value we hold is ours, so linking a hand-entered facility warns too
        var overwritesLocalEdit = hasBaseline ? ours != baseline : ours is not null;
        changes.Add(new FacilityImportFieldChange(field, ours, theirs, overwritesLocalEdit, kept));

        return !kept;
    }

    private static List<FacilityImportFieldChange> NewRowChanges(FacilitySourceSnapshot theirs)
    {
        var incoming = new (FacilityImportField Field, string? Value)[]
        {
            (FacilityImportField.Name, theirs.Name),
            (FacilityImportField.Description, theirs.Description),
            (FacilityImportField.Url, theirs.Url),
            (FacilityImportField.Coordinates, theirs.Coordinates),
        };

        return incoming
            .Where(f => f.Value is not null)
            .Select(f => new FacilityImportFieldChange(f.Field, null, f.Value, OverwritesLocalEdit: false, Kept: false))
            .ToList();
    }

    private static FacilityReference Reference(Facility facility)
    {
        return new FacilityReference(facility.Identifier, facility.Name, facility.FacilityType);
    }

    private static Dictionary<string, int> CountUrls(IEnumerable<string?> urls)
    {
        return urls
            .Select(NormalizeUrl)
            .OfType<string>()
            .GroupBy(u => u, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
    }

    private static string? NormalizeUrl(string? url)
    {
        var trimmed = url?.Trim().TrimEnd('/');

        return string.IsNullOrEmpty(trimmed) ? null : trimmed.ToLowerInvariant();
    }

    private static string NormalizeName(string name)
    {
        var builder = new StringBuilder();

        foreach (var c in name.ToLowerInvariant())
            builder.Append(char.IsLetterOrDigit(c) ? c : ' ');

        var words = builder.ToString()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => !NameNoise.Contains(w));

        return string.Join(' ', words);
    }
}
