import { FirebaseError } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { ApiError, createStigViddUser } from "../../api/users";
import { RegisterData } from "../../data/types";
import { registerUser } from "../auth";

jest.mock("firebase/app", () => {
  class FirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "FirebaseError";
    }
  }
  return { FirebaseError };
});

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  deleteUser: jest.fn(),
}));

jest.mock("../../../firebase-config", () => ({
  auth: {},
}));

jest.mock("@/api/users", () => {
  class ApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }
  return {
    createStigViddUser: jest.fn(),
    ApiError,
  };
});

const mockCreateUserWithEmailAndPassword = createUserWithEmailAndPassword as jest.Mock;
const mockDeleteUser = deleteUser as jest.Mock;
const mockCreateStigViddUser = createStigViddUser as jest.Mock;

const registerData: RegisterData = {
  nickName: "TestUser",
  email: "test@test.com",
  password: "password123",
  confirmPassword: "password123",
};

const mockFirebaseUser = { uid: "test-uid", email: "test@test.com" };

describe("registerUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns success when both Firebase and Stigvidd user creation succeed", async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
    mockCreateStigViddUser.mockResolvedValue({ identifier: "abc", nickName: "TestUser", email: "test@test.com" });

    const result = await registerUser(registerData);

    expect(result.success).toBe(true);
    expect(result.user).toEqual(mockFirebaseUser);
    expect(result.error).toBeNull();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("calls deleteUser to rollback when Stigvidd user creation fails", async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
    mockCreateStigViddUser.mockRejectedValue(new Error("API error"));
    mockDeleteUser.mockResolvedValue(undefined);

    await registerUser(registerData);

    expect(mockDeleteUser).toHaveBeenCalledWith(mockFirebaseUser);
  });

  it("returns failure with unknown error when Stigvidd user creation fails", async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
    mockCreateStigViddUser.mockRejectedValue(new Error("API error"));
    mockDeleteUser.mockResolvedValue(undefined);

    const result = await registerUser(registerData);

    expect(result.success).toBe(false);
    expect(result.user).toBeNull();
    expect(result.error).toEqual({ code: "unknown", message: "Ett oväntat fel inträffade" });
  });

  it("does not call deleteUser when Firebase user creation fails", async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue(new Error("Firebase error"));

    const result = await registerUser(registerData);

    expect(result.success).toBe(false);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("returns FirebaseError code and message when Firebase user creation fails with FirebaseError", async () => {
    const firebaseError = new FirebaseError("auth/email-already-in-use", "Email already in use");
    mockCreateUserWithEmailAndPassword.mockRejectedValue(firebaseError);

    const result = await registerUser(registerData);

    expect(result.success).toBe(false);
    expect(result.error).toEqual({
      code: "auth/email-already-in-use",
      message: "Email already in use",
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("returns api/nickname-taken error when backend returns 409", async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
    mockCreateStigViddUser.mockRejectedValue(new ApiError("nickname-taken", 409));
    mockDeleteUser.mockResolvedValue(undefined);

    const result = await registerUser(registerData);

    expect(result.success).toBe(false);
    expect(result.user).toBeNull();
    expect(result.error).toEqual({ code: "api/nickname-taken", message: "Smeknamnet upptaget" });
    expect(mockDeleteUser).toHaveBeenCalledWith(mockFirebaseUser);
  });

  it("returns unknown error when backend returns a non-409 error", async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
    mockCreateStigViddUser.mockRejectedValue(new ApiError("HTTP error 500", 500));
    mockDeleteUser.mockResolvedValue(undefined);

    const result = await registerUser(registerData);

    expect(result.success).toBe(false);
    expect(result.error).toEqual({ code: "unknown", message: "Ett oväntat fel inträffade" });
    expect(mockDeleteUser).toHaveBeenCalledWith(mockFirebaseUser);
  });

  it("returns failure gracefully when rollback deleteUser also throws", async () => {
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockFirebaseUser });
    mockCreateStigViddUser.mockRejectedValue(new Error("API error"));
    mockDeleteUser.mockRejectedValue(new Error("Delete failed"));

    const result = await registerUser(registerData);

    expect(result.success).toBe(false);
    expect(mockDeleteUser).toHaveBeenCalledWith(mockFirebaseUser);
  });
});
