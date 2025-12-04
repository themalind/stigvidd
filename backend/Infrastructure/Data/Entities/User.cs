using System.ComponentModel.DataAnnotations.Schema;

namespace Infrastructure.Data.Entities;

public class User
{
    public int Id { get; set; }
    public string Identifier { get; set; } = Guid.NewGuid().ToString();
    public required string NickName { get; set; }
    public required string Email { get; set; }

    public Statistics? MyStatistics { get; set; }
}


