// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Core.Services.Events;

// Bound from Events:* so staging can change them without a build. keep-comment: why these are not const
public sealed class EventLimits
{
    public const string Section = "Events";

    public int UpcomingAsOrganizer { get; set; } = 5;
    public int CreatedPerDay { get; set; } = 3;
    public TimeSpan CreatedPerDayWindow { get; set; } = TimeSpan.FromDays(1);
    public int InvitedPerDay { get; set; } = 50;
    public TimeSpan InvitedPerDayWindow { get; set; } = TimeSpan.FromDays(1);

    // A bad value stops the API at start instead of falling back silently. keep-comment: a typo in .env must be seen
    public static OptionsBuilder<EventLimits> Register(IServiceCollection services)
    {
        return services.AddOptions<EventLimits>()
            .BindConfiguration(Section)
            .Validate(l => l.UpcomingAsOrganizer > 0, $"{Section}:UpcomingAsOrganizer must be above 0.")
            .Validate(l => l.CreatedPerDay > 0, $"{Section}:CreatedPerDay must be above 0.")
            .Validate(l => l.CreatedPerDayWindow > TimeSpan.Zero, $"{Section}:CreatedPerDayWindow must be above 0.")
            .Validate(l => l.InvitedPerDay > 0, $"{Section}:InvitedPerDay must be above 0.")
            .Validate(l => l.InvitedPerDayWindow > TimeSpan.Zero, $"{Section}:InvitedPerDayWindow must be above 0.")
            .ValidateOnStart();
    }
}
