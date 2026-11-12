// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class CityAreaFacilityExclusionConfiguration : IEntityTypeConfiguration<CityAreaFacilityExclusion>
{
    public void Configure(EntityTypeBuilder<CityAreaFacilityExclusion> builder)
    {
        builder.HasKey(e => new { e.CityAreaId, e.FacilityId });

        builder.HasOne(e => e.CityArea)
            .WithMany()
            .HasForeignKey(e => e.CityAreaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Facility)
            .WithMany()
            .HasForeignKey(e => e.FacilityId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
