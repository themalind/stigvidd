namespace Core.Results;

public record PagedResult<T>(IReadOnlyCollection<T> Items, int Page, bool HasMore, int TotalCount);
