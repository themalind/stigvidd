// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// keep-comment: a trail an admin took out of an area although its boundary covers it; recalculation never links it again
public class CityAreaTrailExclusion
{
    public int CityAreaId { get; set; }
    public CityArea? CityArea { get; set; }
    public int TrailId { get; set; }
    public Trail? Trail { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
