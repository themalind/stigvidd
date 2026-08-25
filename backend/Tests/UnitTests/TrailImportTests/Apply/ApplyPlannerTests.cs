using Core.TrailImport.Apply;
using Core.TrailImport.Source;
using FluentAssertions;
using Infrastructure.Enums;
using NetTopologySuite.Geometries;

namespace UnitTests.TrailImportTests.Apply;

/// <summary>
/// The rules that decide what an apply may overwrite. Every one of them exists to stop the
/// source taking back a curated field, so they are worth reading as a list: the name and
/// the length are never the source's, a trail with no baseline is left alone entirely, and
/// a field both sides changed keeps ours.
/// </summary>
public class ApplyPlannerTests
{
    private const int TrailId = 42;
    private const string Fingerprint = "abc123";

    private static string Properties(
        string klassning = "Lätt", string tillganglighet = "NEJ",
        string tillgText = "flack grusväg", string sparmarkering = "Blå") =>
        $$"""
        {"klassning":"{{klassning}}","tillganglighet":"{{tillganglighet}}","tillg_text":"{{tillgText}}","sparmarkering":"{{sparmarkering}}"}
        """;

    private static LineString Line(double offset = 0) => GeoPointFactory.FromLonLatPath(
        [new Coordinate(12.9 + offset, 57.7), new Coordinate(12.91 + offset, 57.71)]);

    private static ApplyFeature Feature(
        ProposalDecision decision = ProposalDecision.Accept,
        TrailSourceLinkRole role = TrailSourceLinkRole.Segment,
        string? properties = null,
        int proposalId = 1,
        string fingerprint = Fingerprint,
        int? targetTrailId = TrailId,
        string? decidedName = null,
        decimal? decidedLengthKm = null,
        LineString? geometry = null) =>
        new(proposalId, "4456", "Dannike motionsspår", fingerprint, properties ?? Properties(),
            geometry ?? Line(), decision, role, MatchConfidence.High, targetTrailId,
            decidedName, decidedLengthKm);

    private static ApplyTarget Target(
        string name = "Dannike", int classification = 1, bool accessibility = false,
        string accessibilityInfo = "flack grusväg", string trailSymbol = "Blå") =>
        new(TrailId, name, classification, accessibility, accessibilityInfo, trailSymbol, Line());

    private static ApplyInput Input(
        IEnumerable<ApplyFeature> features,
        ApplyTarget? target = null,
        string? baselineSnapshot = null,
        bool trailHasBaseline = true) =>
        new(
            [.. features],
            new Dictionary<int, ApplyTarget> { [TrailId] = target ?? Target() },
            baselineSnapshot is null
                ? new Dictionary<string, ApplyBaseline>()
                : new Dictionary<string, ApplyBaseline> { [Fingerprint] = new(9, TrailId, baselineSnapshot) },
            trailHasBaseline ? new HashSet<int> { TrailId } : []);

    [Fact]
    public void Plan_OnTheFirstSync_ShouldWriteNoSourceOwnedFieldOnAnExistingTrail()
    {
        // Arrange — no link on file for the feature, so nothing to compare against.
        var input = Input([Feature(properties: Properties(klassning: "Svår"))], trailHasBaseline: false);

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert — the link is written; the trail is not touched at all.
        writes.Links.Should().ContainSingle();
        writes.Updates.Should().BeEmpty();
    }

    [Fact]
    public void Plan_WhenAFeatureIsRelinkedOntoATrailTheSourceHasNeverTouched_ShouldWriteNothingOnIt()
    {
        // Arrange — the feature has a snapshot, so the merge could run; the trail does not,
        // so there is no way to tell a local edit from what its original import left.
        var input = Input(
            [Feature(decision: ProposalDecision.Relink, properties: Properties(klassning: "Svår"))],
            target: Target(classification: (int)Classification.Easy),
            baselineSnapshot: Properties(klassning: "Lätt"),
            trailHasBaseline: false);

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        writes.Updates.Should().BeEmpty();
    }

    [Fact]
    public void Plan_WhenWeNeverTouchedAFieldAndTheSourceChangedIt_ShouldTakeTheSource()
    {
        // Arrange — the trail still says what the last import left; the source now says Hard.
        var input = Input(
            [Feature(properties: Properties(klassning: "Svår"))],
            target: Target(classification: (int)Classification.Easy),
            baselineSnapshot: Properties(klassning: "Lätt"));

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        writes.Updates.Should().ContainSingle()
            .Which.Classification.Should().Be((int)Classification.Hard);
        writes.Conflicts.Should().BeEmpty();
    }

    [Fact]
    public void Plan_WhenWeEditedAFieldAndTheSourceStoodStill_ShouldKeepOurs()
    {
        // Arrange — the source says the same thing it said last time; the symbol is our edit.
        var input = Input(
            [Feature()],
            target: Target(trailSymbol: "Blå/Gul"),
            baselineSnapshot: Properties());

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        writes.Updates.Should().BeEmpty();
        writes.Conflicts.Should().BeEmpty();
    }

    [Fact]
    public void Plan_WhenBothSidesChangedAField_ShouldKeepOursAndReportIt()
    {
        // Arrange
        var input = Input(
            [Feature(properties: Properties(sparmarkering: "Röd"))],
            target: Target(trailSymbol: "Blå/Gul"),
            baselineSnapshot: Properties(sparmarkering: "Blå"));

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        writes.Updates.Should().BeEmpty();

        var conflict = writes.Conflicts.Should().ContainSingle().Subject;
        conflict.Field.Should().Be("TrailSymbol");
        conflict.Ours.Should().Be("Blå/Gul");
        conflict.Theirs.Should().Be("Röd");
    }

    [Fact]
    public void Plan_ForAnAcceptedFeature_ShouldWriteTrailLengthOnlyFromTheReviewersFigure()
    {
        // Arrange — the source's own sparlangd is never read here, only DecidedLengthKm.
        var withoutFigure = Input([Feature()], baselineSnapshot: Properties());
        var withFigure = Input([Feature(decidedLengthKm: 15.72m)], baselineSnapshot: Properties());

        // Act
        var left = ApplyPlanner.Plan(withoutFigure);
        var right = ApplyPlanner.Plan(withFigure);

        // Assert
        left.Updates.Should().BeEmpty();
        right.Updates.Should().ContainSingle().Which.TrailLength.Should().Be(15.72m);
    }

    [Fact]
    public void Plan_ForANewTrail_ShouldTakeTheReviewersNameRatherThanTheSources()
    {
        // Arrange
        var input = Input([Feature(
            decision: ProposalDecision.CreateNew,
            targetTrailId: null,
            decidedName: "Bredareds IF Vit",
            decidedLengthKm: 13m)]);

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        var create = writes.Creates.Should().ContainSingle().Subject;
        create.Name.Should().Be("Bredareds IF Vit");
        create.TrailLength.Should().Be(13m);
        create.TrailSymbol.Should().Be("Blå");
    }

    [Fact]
    public void Plan_ForANewTrailWithNoChosenLength_ShouldMeasureTheLine()
    {
        // Arrange
        var input = Input([Feature(decision: ProposalDecision.CreateNew, targetTrailId: null)]);

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        writes.Creates.Should().ContainSingle()
            .Which.TrailLength.Should().Be(TrailLength.FromGeometry(Line()));
    }

    [Fact]
    public void Plan_ForAnExcludedFeature_ShouldWriteALinkWithNoTrailOnIt()
    {
        // Arrange
        var input = Input([Feature(decision: ProposalDecision.Exclude, targetTrailId: null)]);

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        var link = writes.Links.Should().ContainSingle().Subject;
        link.TrailId.Should().BeNull();
        link.Role.Should().Be(TrailSourceLinkRole.Excluded);
    }

    [Fact]
    public void Plan_ForPendingAndSkippedFeatures_ShouldWriteNothingAtAll()
    {
        // Arrange
        var input = Input(
        [
            Feature(decision: ProposalDecision.Pending, proposalId: 1),
            Feature(decision: ProposalDecision.Skip, proposalId: 2, fingerprint: "def456"),
        ]);

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        writes.Links.Should().BeEmpty();
        writes.Creates.Should().BeEmpty();
        writes.Updates.Should().BeEmpty();
    }

    [Fact]
    public void Plan_ForATrailWhoseFeaturesAreAllDuplicates_ShouldLeaveItsRouteAlone()
    {
        // Arrange — curated geometry is protected by having no Segment to derive from.
        var input = Input(
            [Feature(role: TrailSourceLinkRole.Duplicate)],
            baselineSnapshot: Properties());

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        writes.Updates.Should().BeEmpty();
    }

    [Fact]
    public void Plan_ForATrailWithASegmentFeature_ShouldDeriveItsRouteFromThatLine()
    {
        // Arrange
        var line = Line(offset: 0.5);
        var input = Input([Feature(geometry: line)], baselineSnapshot: Properties());

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        writes.Updates.Should().ContainSingle().Which.GeoPath.Should().BeSameAs(line);
    }

    [Fact]
    public void Plan_ForATrailWithASegmentAndADuplicate_ShouldMergeTheFieldsFromTheSegment()
    {
        // Arrange — the Duplicate belongs to the trail but describes something else.
        var input = Input(
            [
                Feature(role: TrailSourceLinkRole.Duplicate, proposalId: 1, fingerprint: "def456",
                    properties: Properties(sparmarkering: "Gul")),
                Feature(role: TrailSourceLinkRole.Segment, proposalId: 2,
                    properties: Properties(sparmarkering: "Röd")),
            ],
            baselineSnapshot: Properties(sparmarkering: "Blå"));

        // Act
        var writes = ApplyPlanner.Plan(input);

        // Assert
        writes.Updates.Should().ContainSingle().Which.TrailSymbol.Should().Be("Röd");
    }
}
