using System.ComponentModel.DataAnnotations.Schema;

namespace Infrastructure.Data.Entities;

public class User : BaseEntity
{
    public required string NickName { get; set; }
    public required string Email { get; set; }

    public Statistics? MyStatistics { get; set; }
}


