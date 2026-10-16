// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ConsentTextConfiguration : IEntityTypeConfiguration<ConsentText>
{
    public const string HikeTransfer = "hike-transfer";

    public void Configure(EntityTypeBuilder<ConsentText> builder)
    {
        builder.Property(c => c.Kind).HasMaxLength(32);
        builder.Property(c => c.Version).HasMaxLength(32);
        builder.Property(c => c.Locale).HasMaxLength(8);

        builder.HasIndex(c => new { c.Kind, c.Version, c.Locale }).IsUnique();

        // keep-comment: must match publish.consent + publish.consentNote in app/src/i18n/locales for that version
        var created = new DateTime(2026, 10, 15, 0, 0, 0, DateTimeKind.Utc);
        builder.HasData(
            new ConsentText
            {
                Id = 1,
                Kind = HikeTransfer,
                Version = "2026-10-15",
                Locale = "sv",
                Text = "Jag godkänner att jag lämnar ifrån mig den här promenaden till Stigvidd. Text, linje och valda bilder blir Stigvidds. Det går inte att ångra efter att leden publicerats. Din egen promenad kan du fortfarande ta bort.",
                CreatedAt = created,
            },
            new ConsentText
            {
                Id = 2,
                Kind = HikeTransfer,
                Version = "2026-10-15",
                Locale = "en",
                Text = "I agree to hand this walk over to Stigvidd. The text, route and chosen photos become Stigvidd's. This cannot be undone once the trail is published. You can still delete your own walk.",
                CreatedAt = created,
            });
    }
}
