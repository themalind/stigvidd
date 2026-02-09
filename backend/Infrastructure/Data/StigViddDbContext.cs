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
    public DbSet<Statistics> Statistics { get; set; }
    public DbSet<VisitorInformation> VisitorInformations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // https://learn.microsoft.com/en-us/ef/core/modeling/relationships/many-to-many

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
    }
}