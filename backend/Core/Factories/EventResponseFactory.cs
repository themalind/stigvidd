// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Services.Events;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using NetTopologySuite.Geometries;
using WebDataContracts.ResponseModels.Event;

namespace Core.Factories;

public class EventResponseFactory
{
    private readonly string _presentableBaseUrl;

    public EventResponseFactory(IConfiguration configuration)
    {
        _presentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public EventSummaryResponse CreateSummary(EventCard card, double? distanceMeters)
    {
        var route = Route(card.TrailLengthKm, card.RouteLengthMetres, routePath: null);

        return new EventSummaryResponse
        {
            Identifier = card.Identifier,
            Title = card.Title,
            StartsAt = card.StartsAt,
            EndsAt = card.EndsAt,
            PlaceName = card.TrailName ?? card.LocationName ?? card.MeetingPointName,
            RouteKind = route?.Kind,
            RouteLengthMeters = route?.LengthMeters,
            Visibility = card.Visibility.ToString(),
            Status = card.Status.ToString(),
            ParticipantCount = card.ParticipantCount,
            MaxParticipants = card.MaxParticipants,
            ImageUrl = ImageUrl(card.ImageUrl, card.ImageModerationState),
            OrganizerNickName = card.OrganizerNickName,
            DistanceMeters = distanceMeters,
            MyRole = card.MyRole?.ToString(),
            MyStatus = card.MyStatus?.ToString(),
            UnreadPostCount = card.UnreadPostCount,
        };
    }

    public EventResponse Create(EventDetail detail, EventMembership membership, bool showOrganizer, LineString? routePath)
    {
        var e = detail.Event;

        return new EventResponse
        {
            Identifier = e.Identifier,
            Title = e.Title,
            Description = e.Description,
            TrailIdentifier = detail.TrailIdentifier,
            TrailName = detail.TrailName,
            Route = Route(detail.TrailLengthKm, detail.RouteLengthMetres, routePath),
            LocationName = e.LocationName,
            MeetingPointLongitude = GeoPointFactory.ToLongitude(e.MeetingPoint),
            MeetingPointLatitude = GeoPointFactory.ToLatitude(e.MeetingPoint),
            MeetingPointName = e.MeetingPointName,
            StartsAt = e.StartsAt,
            EndsAt = e.EndsAt,
            RegistrationDeadline = e.RegistrationDeadline,
            MaxParticipants = e.MaxParticipants,
            ParticipantCount = e.ParticipantCount,
            InterestedCount = detail.InterestedCount,
            Visibility = e.Visibility.ToString(),
            AllowParticipantInvites = e.AllowParticipantInvites,
            Status = e.Status.ToString(),
            CancelledAt = e.CancelledAt,
            IsPast = membership.IsPast,
            ImageUrl = ImageUrl(detail.ImageUrl, detail.ImageModerationState),
            OrganizerNickName = showOrganizer ? detail.OrganizerNickName : null,
            MyRole = detail.MyRole?.ToString(),
            MyStatus = detail.MyStatus?.ToString(),
            HasPendingInvite = detail.HasPendingInvite,
            Permissions = new EventPermissionsResponse
            {
                CanEdit = membership.CanEdit(),
                CanCancel = membership.CanCancel(),
                CanDelete = membership.CanDelete(),
                CanInvite = membership.CanInvite(),
                CanJoin = membership.CanJoin(),
                CanMarkInterested = membership.CanMarkInterested(),
                CanChangeRoles = membership.CanChangeRoles(),
                CanRemoveParticipants = membership.CanRemove(EventParticipantRole.Participant),
                CanPinOrDeletePosts = membership.CanPinOrDeletePosts(),
                CanReadBoard = membership.CanReadBoard(),
            },
        };
    }

    private static EventRouteResponse? Route(decimal? trailLengthKm, int? routeLengthMetres, LineString? routePath)
    {
        if (trailLengthKm.HasValue)
        {
            return new EventRouteResponse
            {
                Kind = EventRouteResponse.Trail,
                LengthMeters = (int)Math.Round(trailLengthKm.Value * 1000m),
            };
        }

        if (routeLengthMetres.HasValue)
        {
            return new EventRouteResponse
            {
                Kind = EventRouteResponse.Own,
                LengthMeters = routeLengthMetres,
                Coordinates = routePath is null ? null : GeoPathSerializer.ToCoordinateJson(routePath),
            };
        }

        return null;
    }

    private string? ImageUrl(string? relativeUrl, ModerationState? moderationState)
    {
        return relativeUrl is not null && moderationState == ModerationState.Visible
            ? $"{_presentableBaseUrl}{relativeUrl}"
            : null;
    }
}
