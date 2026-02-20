namespace Core;

public class Result
{
    public bool Success { get; }
    public Message? Message { get; private set; }
    public bool IsFailure => !Success;

    protected Result(bool success, Message? message)
    {
        Success = success;
        Message = message;
    }

    public static Result Fail(Message message)
    {
        return new Result(false, message);
    }

    public static Result<T> Fail<T>(Message message)
    {
        return new Result<T>(default, false, message);
    }
    public static Result Ok()
    {
        return new Result(true, null);
    }

    public static Result<T> Ok<T>(T value)
    {
        return new Result<T>(value, true, null);
    }
}

public class Result<T> : Result
{
    public T? Value { get; set; }

    protected internal Result(T? value, bool success, Message? ResultMessage)
        : base(success, ResultMessage)
    {
        Value = value;
    }
}

public class Message
{
    public int StatusCode { get; set; }
    public string? ResultMessage { get; set; }

    public Message(int statusCode, string? resultMessage = default)
    {
        StatusCode = statusCode;
        ResultMessage = resultMessage;
    }
}

// https://achraf-chennan.medium.com/using-the-result-class-in-c-519da90351f0