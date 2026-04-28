using System.Diagnostics.CodeAnalysis;

namespace Core
{
    public class RepositoryResult
    {
        public RepositoryResultStatus Status { get; }
        public bool IsSuccess => Status == RepositoryResultStatus.Success;

        private RepositoryResult(RepositoryResultStatus status)
        {
            Status = status;
        }

        public static RepositoryResult Success() => new(RepositoryResultStatus.Success);
        public static RepositoryResult NotFound() => new(RepositoryResultStatus.NotFound);
        public static RepositoryResult Conflict() => new(RepositoryResultStatus.Conflict);
        public static RepositoryResult Error() => new(RepositoryResultStatus.Error);
    }

    public class RepositoryResult<T>
    {
        public T? Value { get; }
        public RepositoryResultStatus Status { get; }

        [MemberNotNullWhen(true, nameof(Value))]
        public bool IsSuccess => Status == RepositoryResultStatus.Success;

        private RepositoryResult(T? value, RepositoryResultStatus status)
        {
            Value = value;
            Status = status;
        }

        public static RepositoryResult<T> Success(T value) => new(value, RepositoryResultStatus.Success);
        public static RepositoryResult<T> NotFound() => new(default, RepositoryResultStatus.NotFound);
        public static RepositoryResult<T> Conflict() => new(default, RepositoryResultStatus.Conflict);
        public static RepositoryResult<T> Error() => new(default, RepositoryResultStatus.Error);
    }
}
