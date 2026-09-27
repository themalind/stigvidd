// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { userAtom } from "@/atoms/auth-atoms";
import { SessionRecovery } from "@/components/auth/session-recovery";
import { handleUnauthorized } from "@/services/keycloak-auth";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fireEvent, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

jest.mock("@/services/keycloak-auth", () => ({
  ...jest.requireActual("@/services/keycloak-auth"),
  handleUnauthorized: jest.fn(),
}));

const mockHandleUnauthorized = handleUnauthorized as jest.MockedFunction<typeof handleUnauthorized>;

const SIGNED_IN = { id: "subject-1", email: "a@b.se", username: "a" };

function Profile({ load }: { load: () => Promise<string> }) {
  const { data, isError } = useQuery({ queryKey: ["profile"], queryFn: load });
  return <Text>{data ?? (isError ? "failed" : "loading")}</Text>;
}

function Save({ error }: { error: Error }) {
  const mutation = useMutation({ mutationFn: () => Promise.reject(error) });
  return (
    <Pressable testID="save" onPress={() => mutation.mutate()}>
      <Text>{mutation.isError ? "save failed" : "save"}</Text>
    </Pressable>
  );
}

function renderProfile(load: () => Promise<string>, signedIn = true) {
  renderWithProviders(
    <>
      <Profile load={load} />
      <SessionRecovery />
    </>,
    { initialAtoms: signedIn ? [[userAtom, SIGNED_IN]] : [] },
  );
}

beforeEach(() => {
  mockHandleUnauthorized.mockReset();
});

it("refetches after a 401 once the forced refresh succeeds", async () => {
  mockHandleUnauthorized.mockResolvedValue("refreshed");
  const load = jest.fn().mockRejectedValueOnce(new ApiError("expired", 401)).mockResolvedValue("Alice");

  renderProfile(load);
  await flushUntil(() => screen.queryByText("Alice"));

  expect(mockHandleUnauthorized).toHaveBeenCalledTimes(1);
  expect(load).toHaveBeenCalledTimes(2);
});

it("leaves the failed query alone when Keycloak cannot be reached", async () => {
  mockHandleUnauthorized.mockResolvedValue("unavailable");
  const load = jest.fn().mockRejectedValue(new ApiError("expired", 401));

  renderProfile(load);
  await flushUntil(() => screen.queryByText("failed"));
  await settle();

  expect(mockHandleUnauthorized).toHaveBeenCalledTimes(1);
  expect(screen.getByText("failed")).toBeTruthy();
  expect(load).toHaveBeenCalledTimes(1);
});

it("ignores failures that are not a 401", async () => {
  renderProfile(jest.fn().mockRejectedValue(new ApiError("server error", 500)));
  await flushUntil(() => screen.queryByText("failed"));
  await settle();

  expect(mockHandleUnauthorized).not.toHaveBeenCalled();
});

it("does nothing for a signed-out reader", async () => {
  renderProfile(jest.fn().mockRejectedValue(new ApiError("expired", 401)), false);
  await flushUntil(() => screen.queryByText("failed"));
  await settle();

  expect(mockHandleUnauthorized).not.toHaveBeenCalled();
});

it("reacts to a 401 from a mutation as well", async () => {
  mockHandleUnauthorized.mockResolvedValue("unavailable");
  renderWithProviders(
    <>
      <Save error={new ApiError("expired", 401)} />
      <SessionRecovery />
    </>,
    { initialAtoms: [[userAtom, SIGNED_IN]] },
  );

  fireEvent.press(screen.getByTestId("save"));
  await flushUntil(() => mockHandleUnauthorized.mock.calls.length > 0);

  expect(mockHandleUnauthorized).toHaveBeenCalledTimes(1);
});
