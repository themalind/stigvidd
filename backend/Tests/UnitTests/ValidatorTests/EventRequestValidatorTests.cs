// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Validators.Event;
using WebDataContracts.RequestModels.Event;

namespace UnitTests.ValidatorTests;

public class EventRequestValidatorTests
{
    private readonly CreateEventRequestValidator _create = new();
    private readonly UpdateEventRequestValidator _update = new();

    private static CreateEventRequest ValidCreate()
    {
        return new CreateEventRequest
        {
            Title = "Kvällsvandring",
            Description = "Runt sjön",
            Visibility = "Open",
            MeetingPointLongitude = 12.94m,
            MeetingPointLatitude = 57.72m,
            StartsAt = DateTime.UtcNow.AddDays(3),
        };
    }

    private static UpdateEventRequest ValidUpdate()
    {
        return new UpdateEventRequest
        {
            Title = "Kvällsvandring",
            Description = "Runt sjön",
            TrailIdentifier = "trail-1",
            StartsAt = DateTime.UtcNow.AddDays(-1),
        };
    }

    [Fact]
    public void Validate_ValidCreate_ShouldPass()
    {
        _create.Validate(ValidCreate()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_UpdateWithAPastStart_ShouldPass()
    {
        _update.Validate(ValidUpdate()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_CreateWithADeadlineAlreadyPast_ShouldFail()
    {
        var request = ValidCreate();
        request.RegistrationDeadline = DateTime.UtcNow.AddMinutes(-1);

        _create.Validate(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_UpdateWithADeadlineAlreadyPast_ShouldPass()
    {
        var request = ValidUpdate();
        request.RegistrationDeadline = DateTime.UtcNow.AddDays(-2);

        _update.Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_CreateWithAPastStart_ShouldFail()
    {
        var request = ValidCreate();
        request.StartsAt = DateTime.UtcNow.AddMinutes(-1);

        _create.Validate(request).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("Open", true)]
    [InlineData("Private", true)]
    [InlineData("open", false)]
    [InlineData("0", false)]
    [InlineData("2", false)]
    [InlineData("", false)]
    public void Validate_Visibility_IsANamedValue(string visibility, bool valid)
    {
        var request = ValidCreate();
        request.Visibility = visibility;

        _create.Validate(request).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(80, true)]
    [InlineData(81, false)]
    public void Validate_Title_IsRequiredAndBounded(int length, bool valid)
    {
        var request = ValidCreate();
        request.Title = new string('a', length);

        _create.Validate(request).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData(2000, true)]
    [InlineData(2001, false)]
    public void Validate_Description_IsBounded(int length, bool valid)
    {
        var request = ValidUpdate();
        request.Description = new string('a', length);

        _update.Validate(request).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData(100, true)]
    [InlineData(101, false)]
    public void Validate_PlaceNames_AreBounded(int length, bool valid)
    {
        var location = ValidCreate();
        location.LocationName = new string('a', length);
        var meetingPoint = ValidCreate();
        meetingPoint.MeetingPointName = new string('a', length);

        _create.Validate(location).IsValid.Should().Be(valid);
        _create.Validate(meetingPoint).IsValid.Should().Be(valid);
    }

    [Fact]
    public void Validate_WithNeitherMeetingPointNorTrail_ShouldFail()
    {
        var request = ValidCreate();
        request.MeetingPointLatitude = null;
        request.MeetingPointLongitude = null;

        _create.Validate(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithATrailAndNoMeetingPoint_ShouldPass()
    {
        var request = ValidCreate();
        request.MeetingPointLatitude = null;
        request.MeetingPointLongitude = null;
        request.TrailIdentifier = "trail-1";

        _create.Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_CreateWithOnlyAHike_ShouldPass()
    {
        var request = ValidCreate();
        request.MeetingPointLatitude = null;
        request.MeetingPointLongitude = null;
        request.HikeIdentifier = "hike-1";

        _create.Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_UpdateWithNoPlaceInTheRequest_ShouldPass()
    {
        var request = ValidUpdate();
        request.TrailIdentifier = null;

        _update.Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithBothATrailAndAHike_ShouldFail()
    {
        var create = ValidCreate();
        create.TrailIdentifier = "trail-1";
        create.HikeIdentifier = "hike-1";
        var update = ValidUpdate();
        update.HikeIdentifier = "hike-1";

        _create.Validate(create).IsValid.Should().BeFalse();
        _update.Validate(update).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(-1, null, false)]
    [InlineData(2, 2, false)]
    [InlineData(3, 2, false)]
    [InlineData(0, 1, true)]
    [InlineData(null, 5, true)]
    public void Validate_RouteTrimIndexes_LeaveARange(int? start, int? end, bool valid)
    {
        var request = ValidCreate();
        request.HikeIdentifier = "hike-1";
        request.RouteTrimStartIndex = start;
        request.RouteTrimEndIndex = end;

        _create.Validate(request).IsValid.Should().Be(valid);
    }

    [Fact]
    public void Validate_TrimIndexesWithoutAHike_ShouldFail()
    {
        var request = ValidCreate();
        request.RouteTrimStartIndex = 1;

        _create.Validate(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_RemoveRouteTogetherWithAHike_ShouldFail()
    {
        var request = ValidUpdate();
        request.TrailIdentifier = null;
        request.HikeIdentifier = "hike-1";
        request.RemoveRoute = true;

        _update.Validate(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WithHalfAMeetingPoint_ShouldFail()
    {
        var request = ValidCreate();
        request.MeetingPointLongitude = null;
        request.TrailIdentifier = "trail-1";

        _create.Validate(request).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(90.1, 0, false)]
    [InlineData(-90.1, 0, false)]
    [InlineData(0, 180.1, false)]
    [InlineData(0, -180.1, false)]
    [InlineData(90, 180, true)]
    public void Validate_MeetingPoint_IsOnTheGlobe(double latitude, double longitude, bool valid)
    {
        var request = ValidCreate();
        request.MeetingPointLatitude = (decimal)latitude;
        request.MeetingPointLongitude = (decimal)longitude;

        _create.Validate(request).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData(-1, false)]
    [InlineData(0, false)]
    [InlineData(1, true)]
    public void Validate_EndsAt_IsAfterStartsAt(int hours, bool valid)
    {
        var request = ValidCreate();
        request.EndsAt = request.StartsAt.AddHours(hours);

        _create.Validate(request).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData(14, true)]
    [InlineData(15, false)]
    public void Validate_EndsAt_IsAtMostTheMaxDurationAfterStartsAt(int days, bool valid)
    {
        var create = ValidCreate();
        create.EndsAt = create.StartsAt.AddDays(days);
        var update = ValidUpdate();
        update.EndsAt = update.StartsAt.AddDays(days);

        _create.Validate(create).IsValid.Should().Be(valid);
        _update.Validate(update).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData(364, true)]
    [InlineData(366, false)]
    public void Validate_StartsAt_IsAtMostTheMaxLeadTimeAhead(int days, bool valid)
    {
        var create = ValidCreate();
        create.StartsAt = DateTime.UtcNow.AddDays(days);
        var update = ValidUpdate();
        update.StartsAt = DateTime.UtcNow.AddDays(days);

        _create.Validate(create).IsValid.Should().Be(valid);
        _update.Validate(update).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData(1, false)]
    [InlineData(0, true)]
    [InlineData(-1, true)]
    public void Validate_RegistrationDeadline_IsNotAfterStartsAt(int hours, bool valid)
    {
        var request = ValidCreate();
        request.RegistrationDeadline = request.StartsAt.AddHours(hours);

        _create.Validate(request).IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData(1, false)]
    [InlineData(2, true)]
    [InlineData(500, true)]
    [InlineData(501, false)]
    public void Validate_MaxParticipants_LeavesRoomBesideTheOrganizer(int max, bool valid)
    {
        var request = ValidCreate();
        request.MaxParticipants = max;

        _create.Validate(request).IsValid.Should().Be(valid);
    }
}
