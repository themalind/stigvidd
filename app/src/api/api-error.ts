export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = "ApiError";
    this.status = status;
  }
}
