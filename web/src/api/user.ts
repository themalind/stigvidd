import type { StigviddUser } from "@/types/types";
import { usersGetStigViddUser } from "./generated/users/users";

// See trail.ts for the wrapper rationale — delegates to the generated client
// while keeping the app's existing signature. Auth + base URL come from the
// `customFetch` mutator the generated function calls.

export async function getStigviddUser(): Promise<StigviddUser> {
  return (await usersGetStigViddUser()) as StigviddUser;
}
