// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Repositories;
using Core.Validators.HikeSubmission;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class HikeSubmissionRepositoryTests : TestBase
{
    private const string SubmissionIdentifier = "sub-1a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d";

    private static HikeSubmission Submission(HikeSubmissionStatus status = HikeSubmissionStatus.Pending, bool withImage = true) => new()
    {
        Identifier = SubmissionIdentifier,
        UserId = 1,
        SourceHikeId = 1,
        Name = "Kvällsrunda",
        Description = "Runt sjön",
        GeoPath = Utilities.GeoPath((12.94, 57.72), (12.95, 57.73)),
        OriginalGeoPath = Utilities.GeoPath((12.93, 57.71), (12.94, 57.72), (12.95, 57.73)),
        TrailLength = 1.3m,
        Classification = 2,
        Parking = "Grus",
        GettingThere = "Buss 3",
        ShowSubmitterName = true,
        TransferAcceptedAt = new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc),
        ConsentTextId = 2,
        Status = status,
        Images = withImage ? [new HikeSubmissionImage { ImageUrl = "trails/copy.jpeg", Width = 800, Height = 600 }] : [],
    };

    private static (HikeSubmissionRepository Repository, Microsoft.EntityFrameworkCore.IDbContextFactory<StigViddDbContext> Factory) Build(HikeSubmission submission)
    {
        var factory = CreateSeededFactory(db => db.HikeSubmissions.Add(submission));
        return (new HikeSubmissionRepository(factory, NullLogger<HikeSubmissionRepository>.Instance), factory);
    }

    [Fact]
    public async Task Approve_CreatesAVerifiedTrailWithContributionVisitorInfoAndTheSameImageFile()
    {
        var (repository, factory) = Build(Submission());

        var approved = await ApproveOkAsync(repository);

        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var trail = await db.Trails
            .Include(t => t.Contribution)
            .Include(t => t.VisitorInformation)
            .Include(t => t.TrailImages)
            .SingleAsync(t => t.Identifier == approved.TrailIdentifier, TestContext.Current.CancellationToken);

        trail.IsVerified.Should().BeTrue();
        trail.Name.Should().Be("Kvällsrunda");
        trail.Contribution.Should().NotBeNull();
        trail.Contribution.SubmittedByUserId.Should().Be(1);
        trail.Contribution.ShowSubmitterName.Should().BeTrue();
        trail.Contribution.TransferAcceptedAt.Should().Be(new DateTime(2026, 10, 15, 8, 0, 0, DateTimeKind.Utc));
        trail.Contribution.ConsentTextId.Should().Be(2);
        trail.VisitorInformation.Should().NotBeNull();
        trail.VisitorInformation.GettingThere.Should().Be("Buss 3");
        trail.TrailImages.Should().NotBeNull();
        trail.TrailImages.Select(i => i.ImageUrl).Should().Equal("trails/copy.jpeg");

        var submission = await db.HikeSubmissions.Include(s => s.Images).SingleAsync(TestContext.Current.CancellationToken);
        submission.Status.Should().Be(HikeSubmissionStatus.Approved);
        submission.DecidedBy.Should().Be("admin");
        submission.PublishedTrailId.Should().Be(trail.Id);
        submission.Images.Should().BeEmpty("the file now belongs to the trail image, never to two rows");
    }

    [Theory]
    [InlineData("sv", 1)]
    [InlineData("en", 2)]
    public async Task GetConsentTextId_FindsTheSeededWordingForTheCurrentVersion(string locale, int expectedId)
    {
        var (repository, _) = Build(Submission());

        var result = await repository.GetConsentTextIdAsync(HikeSubmissionConsent.CurrentVersion, locale, TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(expectedId);
    }

    [Theory]
    [InlineData("2026-01-01", "sv")]
    [InlineData(HikeSubmissionConsent.CurrentVersion, "de")]
    public async Task GetConsentTextId_WithAnUnknownVersionOrLocale_IsNotFound(string version, string locale)
    {
        var (repository, _) = Build(Submission());

        var result = await repository.GetConsentTextIdAsync(version, locale, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task Approve_WithoutImages_UsesThePlaceholders()
    {
        var (repository, factory) = Build(Submission(withImage: false));

        var approved = await ApproveOkAsync(repository, ["mock/a.jpg", "mock/b.jpg"]);

        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var urls = await db.TrailImages
            .Where(i => i.Trail != null && i.Trail.Identifier == approved.TrailIdentifier)
            .OrderBy(i => i.SortOrder)
            .Select(i => i.ImageUrl)
            .ToListAsync(TestContext.Current.CancellationToken);
        urls.Should().Equal("mock/a.jpg", "mock/b.jpg");
    }

    [Theory]
    [InlineData(HikeSubmissionStatus.Approved)]
    [InlineData(HikeSubmissionStatus.Rejected)]
    public async Task Approve_WhenAlreadyDecided_IsAConflict(HikeSubmissionStatus status)
    {
        var (repository, _) = Build(Submission(status));

        var result = await repository.ApproveAsync(SubmissionIdentifier, "admin", [], TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task Reject_RecordsTheReasonAndHandsBackTheFilesToDelete()
    {
        var (repository, factory) = Build(Submission());

        var result = await repository.RejectAsync(SubmissionIdentifier, "Mest gata", "admin", TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Equal("trails/copy.jpeg");
        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var submission = await db.HikeSubmissions.Include(s => s.Images).SingleAsync(TestContext.Current.CancellationToken);
        submission.Status.Should().Be(HikeSubmissionStatus.Rejected);
        submission.RejectionReason.Should().Be("Mest gata");
        submission.Images.Should().BeEmpty();
    }

    [Fact]
    public async Task Withdraw_ByAnotherUser_IsNotFound()
    {
        var (repository, _) = Build(Submission());

        var result = await repository.WithdrawAsync(SubmissionIdentifier, 2, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.NotFound);
    }

    [Fact]
    public async Task Withdraw_WhenApproved_IsAConflict()
    {
        var (repository, _) = Build(Submission(HikeSubmissionStatus.Approved, withImage: false));

        var result = await repository.WithdrawAsync(SubmissionIdentifier, 1, TestContext.Current.CancellationToken);

        result.Status.Should().Be(RepositoryResultStatus.Conflict);
    }

    [Fact]
    public async Task UpdateGeometry_KeepsTheOriginalPath()
    {
        var (repository, factory) = Build(Submission());
        var edited = Utilities.GeoPath((12.94, 57.72), (12.945, 57.725), (12.95, 57.73));

        var result = await repository.UpdateGeometryAsync(SubmissionIdentifier, edited, 1.4m, 52.5, TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var submission = await db.HikeSubmissions.SingleAsync(TestContext.Current.CancellationToken);
        submission.GeoPath.NumPoints.Should().Be(3);
        submission.TrailLength.Should().Be(1.4m);
        submission.LongestGapMetres.Should().Be(52.5);
        submission.OriginalGeoPath.Coordinates[0].X.Should().Be(12.93);
    }

    [Fact]
    public async Task Approve_LeavesOutACopyWhoseHikePhotoWasHiddenAndHandsBackItsFile()
    {
        var submission = Submission(withImage: false);
        submission.Images =
        [
            new HikeSubmissionImage
            {
                ImageUrl = "trails/kept.jpeg",
                SortOrder = 0,
                SourceHikeImage = new HikeImage { HikeId = 1, ImageUrl = "hikes/a.jpeg", ModerationState = ModerationState.Visible },
            },
            new HikeSubmissionImage
            {
                ImageUrl = "trails/hidden.jpeg",
                SortOrder = 1,
                SourceHikeImage = new HikeImage { HikeId = 1, ImageUrl = "hikes/b.jpeg", ModerationState = ModerationState.HiddenPendingReview },
            },
            new HikeSubmissionImage { ImageUrl = "trails/orphan.jpeg", SortOrder = 2 },
        ];
        var (repository, factory) = Build(submission);

        var approved = await ApproveOkAsync(repository);

        approved.DiscardedImageUrls.Should().Equal("trails/hidden.jpeg");
        await using var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var urls = await db.TrailImages
            .Where(i => i.Trail != null && i.Trail.Identifier == approved.TrailIdentifier)
            .OrderBy(i => i.SortOrder)
            .Select(i => i.ImageUrl)
            .ToListAsync(TestContext.Current.CancellationToken);
        urls.Should().Equal("trails/kept.jpeg", "trails/orphan.jpeg");
    }

    // keep-comment: stands in for two admins deciding at once, which the in-memory provider cannot interleave
    [Fact]
    public async Task Status_IsAConcurrencyToken_SoAStaleDecisionFailsToSave()
    {
        var (_, factory) = Build(Submission());
        await using var first = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        await using var second = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var stale = await first.HikeSubmissions.SingleAsync(TestContext.Current.CancellationToken);
        var winner = await second.HikeSubmissions.SingleAsync(TestContext.Current.CancellationToken);

        winner.Status = HikeSubmissionStatus.Approved;
        await second.SaveChangesAsync(TestContext.Current.CancellationToken);
        stale.Status = HikeSubmissionStatus.Rejected;

        var save = () => first.SaveChangesAsync(TestContext.Current.CancellationToken);

        await save.Should().ThrowAsync<DbUpdateConcurrencyException>();
    }

    [Fact]
    public async Task ApprovedTrail_SurvivesTheSourceHikeBeingDeleted()
    {
        var (repository, factory) = Build(Submission());
        var approved = await ApproveOkAsync(repository);

        await using (var db = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            db.Hikes.Remove(await db.Hikes.SingleAsync(h => h.Id == 1, TestContext.Current.CancellationToken));
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var check = await factory.CreateDbContextAsync(TestContext.Current.CancellationToken);
        (await check.Trails.AnyAsync(t => t.Identifier == approved.TrailIdentifier, TestContext.Current.CancellationToken)).Should().BeTrue();
    }

    private static async Task<ApprovedSubmission> ApproveOkAsync(HikeSubmissionRepository repository, IReadOnlyCollection<string>? placeholders = null)
    {
        var result = await repository.ApproveAsync(SubmissionIdentifier, "admin", placeholders ?? [], TestContext.Current.CancellationToken);

        result.IsSuccess.Should().BeTrue();
        var approved = result.Value;
        approved.Should().NotBeNull();
        return approved;
    }
}
