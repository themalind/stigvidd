// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// keep-comment: a facility an admin took out of an area although its boundary covers it; recalculation never links it again
public class CityAreaFacilityExclusion
{
    public int CityAreaId { get; set; }
    public CityArea? CityArea { get; set; }
    public int FacilityId { get; set; }
    public Facility? Facility { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
