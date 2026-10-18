// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class UserKeycloakMappingConfiguration : IEntityTypeConfiguration<UserKeycloakMapping>
{
    public void Configure(EntityTypeBuilder<UserKeycloakMapping> builder)
    {
        builder.HasKey(m => m.PackageUserId);
        builder.Property(m => m.PackageUserId).ValueGeneratedNever();

        builder.HasIndex(m => m.KeycloakSubjectId).IsUnique();
    }
}
