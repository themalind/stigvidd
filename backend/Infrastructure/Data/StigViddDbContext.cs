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
    public DbSet<HikeShare> HikeShares { get; set; }
    public DbSet<HikeImage> HikeImages { get; set; }
    public DbSet<FriendRequest> FriendRequests { get; set; }
    public DbSet<UserPushToken> UserPushTokens { get; set; }

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

        // Global query filters for soft delete
        modelBuilder.Entity<Hike>().HasQueryFilter(h => !h.IsDeleted);
        modelBuilder.Entity<Review>().HasQueryFilter(r => !r.IsDeleted);
        modelBuilder.Entity<TrailObstacle>().HasQueryFilter(to => !to.IsDeleted);
        modelBuilder.Entity<User>().HasQueryFilter(u => !u.IsDeleted);

        // Deleting a user cascades to their reviews (and review images via Review cascade)
        modelBuilder.Entity<Review>()
            .HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

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

        // Decimal precision for entity properties
        modelBuilder.Entity<Trail>()
            .Property(t => t.TrailLength).HasPrecision(18, 2);

        modelBuilder.Entity<Review>()
            .Property(r => r.Rating).HasPrecision(3, 1);

        modelBuilder.Entity<Hike>()
            .Property(h => h.HikeLength).HasPrecision(18, 2);

        modelBuilder.Entity<TrailObstacle>()
          .Property(to => to.IncidentLatitude)
          .HasPrecision(18, 10); ;

        modelBuilder.Entity<TrailObstacle>()
            .Property(to => to.IncidentLongitude)
            .HasPrecision(18, 10);

        modelBuilder.Entity<Facility>()
           .Property(f => f.Longitude)
           .HasPrecision(18, 5);

        modelBuilder.Entity<Facility>()
           .Property(f => f.Latitude)
           .HasPrecision(18, 5);
    }
}