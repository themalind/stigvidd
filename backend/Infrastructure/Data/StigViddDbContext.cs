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
    public DbSet<UserPushToken> UserPushTokens { get; set; }
    public DbSet<CityArea> CityAreas { get; set; }
    public DbSet<TrailSourceLink> TrailSourceLinks { get; set; }
    public DbSet<TrailImportSession> TrailImportSessions { get; set; }
    public DbSet<TrailImportProposal> TrailImportProposals { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("dbo");

        // https://learn.microsoft.com/en-us/ef/core/modeling/relationships/many-to-many

        modelBuilder.Entity<User>()
            .HasIndex(u => u.NickName)
            .IsUnique();

        // WishList relation
        modelBuilder.Entity<User>()
            .HasMany(u => u.MyWishList)
            .WithMany()
            .UsingEntity<Dictionary<string, object>>(
                "UserWishList",  // Explicit tabellnamn
                r => r.HasOne<Trail>().WithMany().HasForeignKey("TrailId"),
                l => l.HasOne<User>().WithMany().HasForeignKey("UserId"),
                j =>
                {
                    j.HasKey("UserId", "TrailId");
                    j.ToTable("UserWishList");
                });

        // Favorites relation
        modelBuilder.Entity<User>()
            .HasMany(u => u.MyFavorites)
            .WithMany()
            .UsingEntity<Dictionary<string, object>>(
                "UserFavorites",  // Explicit tabellnamn
                r => r.HasOne<Trail>().WithMany().HasForeignKey("TrailId"),
                l => l.HasOne<User>().WithMany().HasForeignKey("UserId"),
                j =>
                {
                    j.HasKey("UserId", "TrailId");
                    j.ToTable("UserFavorites");
                });

        // CityArea ↔ Trail (many-to-many): a trail can pass through several areas
        modelBuilder.Entity<CityArea>()
            .HasMany(a => a.Trails)
            .WithMany(t => t.CityAreas)
            .UsingEntity<Dictionary<string, object>>(
                "CityAreaTrail",  // Explicit tabellnamn
                r => r.HasOne<Trail>().WithMany().HasForeignKey("TrailId"),
                l => l.HasOne<CityArea>().WithMany().HasForeignKey("CityAreaId"),
                j =>
                {
                    j.HasKey("CityAreaId", "TrailId");
                    j.ToTable("CityAreaTrail");
                });

        // CityArea ↔ Facility (many-to-many): a facility can belong to several areas
        modelBuilder.Entity<CityArea>()
            .HasMany(a => a.Facilities)
            .WithMany(f => f.CityAreas)
            .UsingEntity<Dictionary<string, object>>(
                "CityAreaFacility",  // Explicit tabellnamn
                r => r.HasOne<Facility>().WithMany().HasForeignKey("FacilityId"),
                l => l.HasOne<CityArea>().WithMany().HasForeignKey("CityAreaId"),
                j =>
                {
                    j.HasKey("CityAreaId", "FacilityId");
                    j.ToTable("CityAreaFacility");
                });

        // Configures a one-to-one relationship where Trail has a VisitorInformation,
        // but VisitorInformation is the dependent side with TrailId as foreign key.
        // The Trail table won't have a VisitorInformationId. Deleting a Trail cascades to VisitorInformation.
        modelBuilder.Entity<Trail>()
            .HasOne(t => t.VisitorInformation)
            .WithOne()
            .HasForeignKey<VisitorInformation>("TrailId")
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TrailObstacleSolvedVote>()
            .HasIndex(v => new { v.TrailObstacleId, v.UserId })
            .IsUnique();

        // Each solved vote belongs to one obstacle; obstacle can have many solved votes
        modelBuilder.Entity<TrailObstacleSolvedVote>()
            .HasOne(solvedVote => solvedVote.TrailObstacle)
            .WithMany(to => to.SolvedVotes)
            .HasForeignKey(solvedVote => solvedVote.TrailObstacleId)
            .OnDelete(DeleteBehavior.NoAction); // Prevent cascade delete when obstacle is removed

        // Each solved vote is cast by one user; deleting the user cascades to their votes
        modelBuilder.Entity<TrailObstacleSolvedVote>()
            .HasOne(solvedVote => solvedVote.User)
            .WithMany()
            .HasForeignKey(solvedVote => solvedVote.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // TrailObstacle → User (SetNull on user delete)
        modelBuilder.Entity<TrailObstacle>()
            .HasOne(to => to.User)
            .WithMany()
            .HasForeignKey(to => to.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Review → User (SetNull on user delete)
        modelBuilder.Entity<Review>()
            .HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Hike → User (SetNull on user delete)
        modelBuilder.Entity<Hike>()
            .HasOne(h => h.User)
            .WithMany()
            .HasForeignKey(h => h.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // HikeShare → Hike (cascade delete when hike is hard-deleted)
        modelBuilder.Entity<HikeShare>()
            .HasOne(hs => hs.Hike)
            .WithMany()
            .HasForeignKey(hs => hs.HikeId)
            .OnDelete(DeleteBehavior.Cascade);

        // HikeShare composite key
        modelBuilder.Entity<HikeShare>()
            .HasKey(hs => new { hs.HikeId, hs.SharedWithId });

        // HikeShare → SharedWith user (NoAction; service handles deletion on user delete)
        modelBuilder.Entity<HikeShare>()
            .HasOne(hs => hs.SharedWith)
            .WithMany()
            .HasForeignKey(hs => hs.SharedWithId)
            .OnDelete(DeleteBehavior.NoAction);

        // HikeShare → SharedBy user (SetNull; sharer may delete account but share row stays)
        modelBuilder.Entity<HikeShare>()
            .HasOne(hs => hs.SharedBy)
            .WithMany()
            .HasForeignKey(hs => hs.SharedById)
            .OnDelete(DeleteBehavior.SetNull);

        // HikeImage → Hike (cascade delete)
        modelBuilder.Entity<HikeImage>()
            .HasOne(hi => hi.Hike)
            .WithMany(h => h.Images)
            .HasForeignKey(hi => hi.HikeId)
            .OnDelete(DeleteBehavior.Cascade);

        // FacilityImage → Facility (cascade delete)
        modelBuilder.Entity<FacilityImage>()
            .HasOne(fi => fi.Facility)
            .WithMany(f => f.Images)
            .HasForeignKey(fi => fi.FacilityId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<FriendRequest>()
            .HasKey(fr => new { fr.RequesterId, fr.ReceiverId });

        modelBuilder.Entity<FriendRequest>()
            .HasOne(fr => fr.Requester)
            .WithMany()
            .HasForeignKey(fr => fr.RequesterId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<FriendRequest>()
            .HasOne(fr => fr.Receiver)
            .WithMany()
            .HasForeignKey(fr => fr.ReceiverId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<UserPushToken>()
            .HasOne(upt => upt.User)
            .WithMany()
            .HasForeignKey(upt => upt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserPushToken>()
            .HasIndex(upt => upt.ExpoToken)
            .IsUnique();

        // TrailSourceLink → Trail (SetNull; the link outlives the trail, so a deleted
        // trail is not silently recreated by the next sync)
        modelBuilder.Entity<TrailSourceLink>()
            .HasOne(l => l.Trail)
            .WithMany(t => t.SourceLinks)
            .HasForeignKey(l => l.TrailId)
            .OnDelete(DeleteBehavior.SetNull);

        // One link per feature per source; the fingerprint is what the sync matches on
        modelBuilder.Entity<TrailSourceLink>()
            .HasIndex(l => new { l.Source, l.GeometryFingerprint })
            .IsUnique();

        // Looking a feature up by the id it last carried, for troubleshooting. Not unique.
        modelBuilder.Entity<TrailSourceLink>()
            .HasIndex(l => new { l.Source, l.LastSeenExternalId });

        // Stored as jsonb so a later sync can read single properties out of the snapshot
        modelBuilder.Entity<TrailSourceLink>()
            .Property(l => l.SourceSnapshot)
            .HasColumnType("jsonb");

        // TrailImportProposal → TrailImportSession (cascade; a proposal means nothing
        // without the session it was analysed in)
        modelBuilder.Entity<TrailImportProposal>()
            .HasOne(p => p.Session)
            .WithMany(s => s.Proposals)
            .HasForeignKey(p => p.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Spotting that the same export file has been uploaded before. Not unique.
        modelBuilder.Entity<TrailImportSession>()
            .HasIndex(s => new { s.Source, s.FileHash });

        modelBuilder.Entity<TrailImportSession>()
            .Property(s => s.ApplyReport)
            .HasColumnType("jsonb");

        modelBuilder.Entity<TrailImportProposal>()
            .Property(p => p.FeatureProperties)
            .HasColumnType("jsonb");

        // Decimal precision for entity properties
        modelBuilder.Entity<Trail>()
            .Property(t => t.TrailLength).HasPrecision(18, 2);

        modelBuilder.Entity<TrailImportProposal>()
            .Property(p => p.DecidedLengthKm).HasPrecision(18, 2);

        modelBuilder.Entity<Review>()
            .Property(r => r.Rating).HasPrecision(3, 1);

        modelBuilder.Entity<Hike>()
            .Property(h => h.HikeLength).HasPrecision(18, 2);

        // Point geometry columns. Trail/Hike GeoPath is mapped by convention, but these two
        // need provider-specific help:
        //  - Npgsql gets the real typmod, so the column itself constrains type and SRID.
        //  - EF's SQLite provider registers geometry columns via AddGeometryColumn at SRID 0
        //    by default and SpatiaLite enforces that on insert, so the SRID the services
        //    write (4326) has to be pinned for the SQLite test schema too.
        if (Database.IsNpgsql())
        {
            modelBuilder.Entity<Facility>()
                .Property(f => f.Coordinates)
                .HasColumnType("geometry(Point, 4326)");

            modelBuilder.Entity<TrailObstacle>()
                .Property(to => to.IncidentLocation)
                .HasColumnType("geometry(Point, 4326)");

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
    }
}
