// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class CityAreaConfiguration : IEntityTypeConfiguration<CityArea>
{
    public void Configure(EntityTypeBuilder<CityArea> builder)
    {
        builder.HasMany(a => a.Trails)
            .WithMany(t => t.CityAreas)
            .UsingEntity<Dictionary<string, object>>(
                "CityAreaTrail",
                r => r.HasOne<Trail>().WithMany().HasForeignKey("TrailId"),
                l => l.HasOne<CityArea>().WithMany().HasForeignKey("CityAreaId"),
                j =>
                {
                    j.HasKey("CityAreaId", "TrailId");
                    j.ToTable("CityAreaTrail");
                });

        builder.HasMany(a => a.Facilities)
            .WithMany(f => f.CityAreas)
            .UsingEntity<Dictionary<string, object>>(
                "CityAreaFacility",
                r => r.HasOne<Facility>().WithMany().HasForeignKey("FacilityId"),
                l => l.HasOne<CityArea>().WithMany().HasForeignKey("CityAreaId"),
                j =>
                {
                    j.HasKey("CityAreaId", "FacilityId");
                    j.ToTable("CityAreaFacility");
                });
    }
}
