namespace Infrastructure.Data.Entities;

public abstract class BaseEntity
{
    public int Id { get; set; }
    public string Identifier { get; set; } = Guid.NewGuid().ToString();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;

}

