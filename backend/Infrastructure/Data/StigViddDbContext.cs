// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Data;

public class StigViddDbContext(DbContextOptions<StigViddDbContext> options) : DbContext(options)
{
    public DbSet<Trail> Trails { get; set; }
    public DbSet<TrailImage> TrailImages { get; set; }
    public DbSet<TrailLink> TrailLinks { get; set; }
    public DbSet<Review> Reviews { get; set; }
    public DbSet<ReviewImage> ReviewImages { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<VisitorInformation> VisitorInformations { get; set; }
    public DbSet<Hike> Hikes { get; set; }
    public DbSet<TrailObstacle> TrailObstacles { get; set; }
    public DbSet<TrailObstacleSolvedVote> TrailObstacleSolvedVotes { get; set; }
    public DbSet<Facility> Facilities { get; set; }
    public DbSet<FacilityImage> FacilityImages { get; set; }
    public DbSet<HikeShare> HikeShares { get; set; }
    public DbSet<HikeImage> HikeImages { get; set; }
    public DbSet<FriendRequest> FriendRequests { get; set; }
    public DbSet<UserBlock> UserBlocks { get; set; }
    public DbSet<UserBan> UserBans { get; set; }
    public DbSet<UserPushToken> UserPushTokens { get; set; }
    public DbSet<CityArea> CityAreas { get; set; }
    public DbSet<TrailSourceLink> TrailSourceLinks { get; set; }
    public DbSet<TrailImportSession> TrailImportSessions { get; set; }
    public DbSet<TrailImportProposal> TrailImportProposals { get; set; }
    public DbSet<TrailRelation> TrailRelations { get; set; }
    public DbSet<MailTemplate> MailTemplates { get; set; }
    public DbSet<OutboxEmail> OutboxEmails { get; set; }
    public DbSet<EmailVerificationToken> EmailVerificationTokens { get; set; }
    public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }
    public DbSet<ContentReport> ContentReports { get; set; }
    public DbSet<MediaReprocessJob> MediaReprocessJobs { get; set; }
    public DbSet<MediaReprocessItem> MediaReprocessItems { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("dbo");

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(StigViddDbContext).Assembly);

        ConfigureGeometry(modelBuilder);
    }

    private void ConfigureGeometry(ModelBuilder modelBuilder)
    {
        // Geometry columns. Every one of them is SRID 4326 (WGS84) — the Points and the
        // LineStrings alike — and each needs the same two bits of provider-specific help:
        //  - Npgsql gets the real typmod, so the column itself constrains type and SRID.
        //  - EF's SQLite provider registers geometry columns via AddGeometryColumn at SRID 0
        //    by default, and SpatiaLite enforces that on insert in BOTH directions: a 4326
        //    value into an SRID-0 column is rejected exactly as hard as the reverse. So the
        //    SRID the writers produce (always 4326, via GeoPointFactory) has to be pinned for
        //    the SQLite test schema too, or every geometry seed fails to insert.
        if (Database.IsNpgsql())
        {
            modelBuilder.Entity<Facility>()
                .Property(f => f.Coordinates)
                .HasColumnType("geometry(Point, 4326)");

            modelBuilder.Entity<TrailObstacle>()
                .Property(to => to.IncidentLocation)
                .HasColumnType("geometry(Point, 4326)");

            // The paths. Pinned to the LineString subtype as well as the SRID: the CLR
            // properties are LineString, so a stray Point row would throw an
            // InvalidCastException on read anyway — better the database refuses it once, at
            // migration time, than on a random request.
            modelBuilder.Entity<Trail>()
                .Property(t => t.GeoPath)
                .HasColumnType("geometry(LineString, 4326)");

            modelBuilder.Entity<Hike>()
                .Property(h => h.GeoPath)
                .HasColumnType("geometry(LineString, 4326)");

            modelBuilder.Entity<TrailImportProposal>()
                .Property(p => p.FeatureGeometry)
                .HasColumnType("geometry(LineString, 4326)");

            // Proximity queries are the reason these are geometry columns at all; without a
            // GIST index they are sequential scans. Npgsql-only: "gist" is not an index
            // method SQLite understands, and the test schema comes from EnsureCreated().
            modelBuilder.Entity<Facility>()
                .HasIndex(f => f.Coordinates)
                .HasMethod("gist");

            modelBuilder.Entity<TrailObstacle>()
                .HasIndex(to => to.IncidentLocation)
                .HasMethod("gist");
        }

        // Set as a raw annotation rather than the provider's .HasSrid(4326), and left
        // unguarded rather than wrapped in Database.IsSqlite(): this project references no
        // SQLite provider, so neither API exists here. The annotation is inert under Npgsql
        // (it only travels into the model snapshot), so applying it unconditionally is safe.
        modelBuilder.Entity<Facility>()
            .Property(f => f.Coordinates)
            .HasAnnotation("Sqlite:Srid", 4326);

        modelBuilder.Entity<TrailObstacle>()
            .Property(to => to.IncidentLocation)
            .HasAnnotation("Sqlite:Srid", 4326);

        modelBuilder.Entity<Trail>()
            .Property(t => t.GeoPath)
            .HasAnnotation("Sqlite:Srid", 4326);

        modelBuilder.Entity<Hike>()
            .Property(h => h.GeoPath)
            .HasAnnotation("Sqlite:Srid", 4326);

        modelBuilder.Entity<TrailImportProposal>()
            .Property(p => p.FeatureGeometry)
            .HasAnnotation("Sqlite:Srid", 4326);
    }
}
