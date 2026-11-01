// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class DomainEventRecordConfiguration : IEntityTypeConfiguration<DomainEventRecord>
{
    public void Configure(EntityTypeBuilder<DomainEventRecord> builder)
    {
        // Plain columns on purpose: the integration tests build this schema on SQLite. keep-comment: constrains how this index may change
        builder.HasIndex(e => new { e.Status, e.NextAttemptAt });

        // SQLite gives jsonb NUMERIC affinity; harmless because a payload is always a JSON object. keep-comment: why jsonb survives the SQLite tests
        builder.Property(e => e.Payload).HasColumnType("jsonb");

        // Makes every UPDATE carry AND Status = @original, which is the claim guard against a second writer. keep-comment: load-bearing token
        builder.Property(e => e.Status).IsConcurrencyToken();

        builder.Property(e => e.EventType).HasMaxLength(DomainEventRecord.MaxKeyLength);
        builder.Property(e => e.EntityKey).HasMaxLength(DomainEventRecord.MaxKeyLength);
        builder.Property(e => e.LastError).HasMaxLength(2000);
    }
}
