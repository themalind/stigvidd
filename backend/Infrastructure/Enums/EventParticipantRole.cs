// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

public enum EventParticipantRole
{
    Organizer = 0,
    CoHost = 1,
    Participant = 2,
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data. keep-comment: stored values, and Organizer = 0 is in a filtered index
