// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class MailTemplateConfiguration : IEntityTypeConfiguration<MailTemplate>
{
    public void Configure(EntityTypeBuilder<MailTemplate> builder)
    {
        builder.HasIndex(t => new { t.Key, t.Language })
            .IsUnique();
    }
}
