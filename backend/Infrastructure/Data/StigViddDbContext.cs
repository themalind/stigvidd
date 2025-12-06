using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Data;

public class StigViddDbContext : DbContext
{
    public StigViddDbContext(DbContextOptions<StigViddDbContext> options)
        : base(options)
    {
    }

    public DbSet<Trail> Trails { get; set; }
    public DbSet<TrailImage> TrailImages { get; set; }
    public DbSet<TrailLink> TrailLinks { get; set; }
    public DbSet<Review> Reviews { get; set; }
    public DbSet<ReviewImage> ReviewImages { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Statistics> Statistics { get; set; }
}