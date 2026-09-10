// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import TrailObstacleUpdateForm from "@/components/trail/obstacle/trail-obstacle-update-form";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { strayText } from "@/test/tree";
import { fireEvent, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockUpdate = jest.fn();
const mockIssueTypes = jest.fn();

jest.mock("@/api/trail-obstacles", () => ({
  updateTrailObstacle: (...args: unknown[]) => mockUpdate(...args),
  getObstacleIssueTypes: () => mockIssueTypes(),
}));

const OBSTACLE_ID = "f1b0a9c7-6d55-4f2a-9c0b-3e7d8a1b2c34";
const TRAIL_ID = "6c2d9e10-4b3a-4f8e-8a7d-2b1c0d9e8f77";
const DESCRIPTION = "Ett träd ligger över spången vid bäcken";

const onDismiss = jest.fn();

async function show(props: { visible?: boolean; initialDescription?: string; initialIssueType?: string } = {}) {
  const rendered = renderWithProviders(
    <TrailObstacleUpdateForm
      obstacleIdentifier={OBSTACLE_ID}
      trailIdentifier={TRAIL_ID}
      initialDescription={props.initialDescription ?? DESCRIPTION}
      initialIssueType={props.initialIssueType ?? "FallenTree"}
      visible={props.visible ?? true}
      onDismiss={onDismiss}
    />,
  );
  // The category list is a query of its own, and the picker only appears once it lands.
  await flushUntil(() => screen.queryByText("Nedfallet träd") ?? !(props.visible ?? true));
  return rendered;
}

async function write(text: string) {
  fireEvent.changeText(screen.getByTestId("obstacle-update-description"), text);
  await settle();
}

async function save() {
  fireEvent.press(screen.getByTestId("obstacle-update-submit"));
  await settle();
}

// Android renders pickable rows; iOS renders a native wheel no query can reach. See
// docs/notes/app-component-testing-what-layout-can-be-asserted.md.
async function pickCategory(label: string) {
  const original = Platform.OS;
  Platform.OS = "android";
  try {
    fireEvent.press(screen.getByText("Nedfallet träd"));
    await settle();
    fireEvent.press(screen.getByText(label));
    await settle();
  } finally {
    Platform.OS = original;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({ success: true });
  mockIssueTypes.mockResolvedValue(["FallenTree", "Mud", "Other"]);
});

it("opens on what the report says today, rather than an empty form", async () => {
  await show();

  expect(screen.getByText("Redigera hinder")).toBeTruthy();
  expect(screen.getByTestId("obstacle-update-description").props.value).toBe(DESCRIPTION);
  expect(screen.getByText("Nedfallet träd")).toBeTruthy();
});

it("stays out of the way until it is opened", async () => {
  await show({ visible: false });

  expect(screen.queryByText("Redigera hinder")).toBeNull();
});

it("closes without saving when the close icon is pressed", async () => {
  await show();

  fireEvent.press(screen.getByTestId("icon-close"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it("saves the edited description against the obstacle it was opened on", async () => {
  await show();

  await write("Trädet är bortsågat men spången är trasig");
  await save();

  expect(mockUpdate).toHaveBeenCalledWith(OBSTACLE_ID, {
    description: "Trädet är bortsågat men spången är trasig",
    issueType: "FallenTree",
  });
});

it("saves the category the reporter picked instead of the one it opened with", async () => {
  await show();

  await pickCategory("Lerigt");
  await save();

  expect(mockUpdate).toHaveBeenCalledWith(OBSTACLE_ID, { description: DESCRIPTION, issueType: "Mud" });
});

// A one-word report helps nobody, and fifteen characters is the backend validator's limit.
it("refuses a description that is too short, and sends nothing", async () => {
  await show();

  await write("Trasig");
  await save();

  expect(screen.getByText("Beskrivning för kort minst 15 tecken")).toBeTruthy();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it("refuses an emptied description", async () => {
  await show();

  await write("");
  await save();

  expect(screen.getByText("Beskrivning för kort minst 15 tecken")).toBeTruthy();
  expect(mockUpdate).not.toHaveBeenCalled();
});

// The column is 500 characters wide; the field stops before the validator has to.
it("stops the description at the length the backend accepts", async () => {
  await show();

  expect(screen.getByTestId("obstacle-update-description").props.maxLength).toBe(500);
});

it("closes and says so once the change is saved", async () => {
  const { store } = await show();

  await write("Trädet är bortsågat men spången är trasig");
  await save();
  await flushUntil(() => onDismiss.mock.calls.length > 0);

  expect(onDismiss).toHaveBeenCalled();
  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "success", message: "Uppdaterat!" });
});

// Closing on a failure would throw away what the reporter just wrote.
it("keeps the form open and says so when saving fails", async () => {
  mockUpdate.mockRejectedValue(new Error("500"));
  const { store } = await show();

  await write("Trädet är bortsågat men spången är trasig");
  await save();
  await flushUntil(() => store.get(snackbarAtom).visible);

  expect(store.get(snackbarAtom)).toMatchObject({ type: "error", message: "Något gick fel, försök igen senare" });
  expect(onDismiss).not.toHaveBeenCalled();
  expect(screen.getByText("Redigera hinder")).toBeTruthy();
});

// A second press would send the same edit twice.
it("says it is saving, and takes no second press, while the save is on its way", async () => {
  let release: (value: { success: boolean }) => void = () => {};
  mockUpdate.mockReturnValue(new Promise<{ success: boolean }>((resolve) => (release = resolve)));
  await show();

  await write("Trädet är bortsågat men spången är trasig");
  await save();

  expect(screen.getByText("Sparar...")).toBeTruthy();
  await save();
  expect(mockUpdate).toHaveBeenCalledTimes(1);

  release({ success: true });
  await settle();
});

it("shows no category picker before the categories have arrived", async () => {
  mockIssueTypes.mockReturnValue(new Promise(() => {}));
  await show();

  expect(screen.getByText("Välj en kategori")).toBeTruthy();
  expect(screen.queryByText("Nedfallet träd")).toBeNull();
  expect(screen.getByTestId("obstacle-update-submit")).toBeTruthy();
});

// issueTypes?.length puts the number 0 in the tree, and a raw string under a View is a red box
// on a device that no query can see.
it("renders no stray zero when the category list comes back empty", async () => {
  mockIssueTypes.mockResolvedValue([]);
  const rendered = await show();
  await settle();

  expect(strayText(rendered.toJSON())).toEqual([]);
});
