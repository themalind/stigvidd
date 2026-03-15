namespace Infrastructure.Enums;

public enum TrailIssueType
{
    Other = 0,
    FallenTree = 1,
    Mud = 2,
    Flooding = 3,
    Shelter = 4,
    FirePit = 5,
    Walkway = 6, 
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.