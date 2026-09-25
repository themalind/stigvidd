// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class OutboxEmailConfiguration : IEntityTypeConfiguration<OutboxEmail>
{
    public void Configure(EntityTypeBuilder<OutboxEmail> builder)
    {
        // Plain columns on purpose: the integration tests build this schema on SQLite. keep-comment: constrains how this index may change
        builder.HasIndex(e => new { e.Status, e.NextAttemptAt });
    }
}
