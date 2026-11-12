// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Push.Models;

// StartsAt is the new start when it moved, else null. keep-comment: an empty change sends no push
public sealed record EventChange(DateTime? StartsAt, bool EndsAt, bool Place)
{
    public bool Any()
    {
        return StartsAt is not null || EndsAt || Place;
    }
}
