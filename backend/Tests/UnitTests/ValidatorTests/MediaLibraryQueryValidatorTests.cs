// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.Media;
using WebDataContracts.RequestModels.Media;

namespace UnitTests.ValidatorTests;

public class MediaLibraryQueryValidatorTests
{
    private readonly MediaLibraryQueryValidator _validator = new();

    private static MediaLibraryQuery Query() => new();

    [Fact]
    public void TheDefaultQuery_IsAccepted()
    {
        // Arrange
        var query = Query();

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("Trail")]
    [InlineData("trail")]
    [InlineData("TRAILSYMBOL")]
    [InlineData(" Facility ")]
    public void AnOwnerTypeInAnyCasing_IsAccepted(string ownerType)
    {
        // Arrange
        var query = Query();
        query.OwnerType = ownerType;

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void AnUnknownOwnerType_IsRejected()
    {
        // Arrange
        var query = Query();
        query.OwnerType = "Trials";

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void EveryOwnerTypeTheValidatorAccepts_IsOneTheRepositoryCanResolve()
    {
        // Arrange
        // Act
        // Assert — the validator accepts any casing, so the repository must canonicalise rather
        // than compare; an accepted value that canonicalises to null is an empty 200.
        foreach (var ownerType in MediaOwnerTypes.All)
        {
            MediaOwnerTypes.Canonical(ownerType.ToLowerInvariant()).Should().Be(ownerType);
            MediaOwnerTypes.Canonical(ownerType.ToUpperInvariant()).Should().Be(ownerType);
        }
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void APageBelowOne_IsRejected(int page)
    {
        // Arrange
        var query = Query();
        query.Page = page;

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void APageBeyondTheCap_IsRejected()
    {
        // Arrange
        var query = Query();
        query.Page = MediaLibraryQuery.MaxPage + 1;

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void ThePageCapKeepsTheOffsetInsideAnInt()
    {
        // Arrange
        // Act
        var largestOffset = (long)(MediaLibraryQuery.MaxPage - 1) * MediaLibraryQuery.MaxPageSize;

        // Assert
        largestOffset.Should().BeLessThan(int.MaxValue);
    }

    [Fact]
    public void APageSizeBeyondTheCap_IsRejected()
    {
        // Arrange
        var query = Query();
        query.PageSize = MediaLibraryQuery.MaxPageSize + 1;

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("newest")]
    [InlineData("Oldest")]
    [InlineData("LARGEST")]
    [InlineData("widest")]
    public void AKnownSort_IsAccepted(string sort)
    {
        // Arrange
        var query = Query();
        query.Sort = sort;

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void AnUnknownSort_IsRejected()
    {
        // Arrange
        var query = Query();
        query.Sort = "smallest";

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void EverySortTheValidatorAccepts_IsOneTheRepositoryOrdersBy()
    {
        // Arrange
        // Act
        var parsed = MediaSorts.All.Select(MediaSorts.Parse).ToList();

        // Assert — a value the validator lets through but Ordered does not name falls into the
        // default branch and silently sorts by something the caller did not ask for.
        parsed.Should().OnlyHaveUniqueItems();
        parsed.Should().HaveCount(MediaSorts.All.Count);
    }

    [Fact]
    public void AnUnknownFormat_IsRejected()
    {
        // Arrange
        var query = Query();
        query.Format = "wepb";

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void ATargetFormatNoReprocessCanProduce_IsRejected()
    {
        // Arrange
        var query = Query();
        query.TargetFormat = "gif";

        // Act
        var result = _validator.Validate(query);

        // Assert — gif is a format the library may hold, but not one a batch can convert to,
        // so a filter counting images for that target would describe a batch that cannot run.
        result.IsValid.Should().BeFalse();
        MediaFormats.Filterable.Should().Contain("gif");
    }

    [Fact]
    public void EveryReprocessTarget_IsAlsoAnOutputFormat()
    {
        // Arrange
        // Act
        // Assert
        MediaFormats.ReprocessTarget.Should().BeSubsetOf(MediaFormats.Output);
        MediaFormats.Output.Should().Contain("original");
        MediaFormats.ReprocessTarget.Should().NotContain("original");
    }

    [Fact]
    public void AMinGreaterThanItsMax_IsRejected()
    {
        // Arrange
        var query = Query();
        query.MinWidth = 900;
        query.MaxWidth = 800;

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void ACreatedRangeThatEndsBeforeItStarts_IsRejected()
    {
        // Arrange
        var query = Query();
        query.CreatedFrom = new DateTime(2026, 3, 12, 0, 0, 0, DateTimeKind.Utc);
        query.CreatedTo = new DateTime(2026, 3, 11, 0, 0, 0, DateTimeKind.Utc);

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void ATargetMaxWidthOfZero_IsRejected()
    {
        // Arrange
        var query = Query();
        query.TargetMaxWidth = 0;

        // Act
        var result = _validator.Validate(query);

        // Assert
        result.IsValid.Should().BeFalse();
    }
}
