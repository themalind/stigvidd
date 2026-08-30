// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// What a source feature contributes to the trail it is linked to.
public enum TrailSourceLinkRole
{
    Segment = 0,    // part of the trail's route; GeoPath is merged from every Segment link
    Duplicate = 1,  // belongs to the trail but adds no geometry, e.g. an aggregate feature
    Excluded = 2,   // deliberately not published
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
