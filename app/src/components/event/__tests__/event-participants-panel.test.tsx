// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import EventParticipantsPanel, { PARTICIPANTS_PAGE } from "@/components/event/event-participants-panel";
import { EventParticipants, EventPermissions } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const NO_PERMISSIONS: EventPermissions = {
  canEdit: false,
  canCancel: false,
  canDelete: false,
  canInvite: false,
  canJoin: false,
  canMarkInterested: false,
  canChangeRoles: false,
  canRemoveParticipants: false,
  canPinOrDeletePosts: false,
  canReadBoard: true,
  canPost: true,
};

const PARTICIPANTS: EventParticipants = {
  participantCount: 3,
  interestedCount: 0,
  participants: [
    { userIdentifier: "me", nickName: "jag", role: "Organizer", joinedAt: "2026-10-01T10:00:00Z" },
    { userIdentifier: "u2", nickName: "bertil", role: "CoHost", joinedAt: "2026-10-02T10:00:00Z" },
    { userIdentifier: "u3", nickName: "cissi", role: "Participant", joinedAt: "2026-10-03T10:00:00Z" },
  ],
  invited: [],
};

async function show(permissions: EventPermissions, participants: EventParticipants = PARTICIPANTS) {
  await renderWithProviders(
    <EventParticipantsPanel
      participants={participants}
      permissions={permissions}
      myNickName="jag"
      onSetRole={jest.fn()}
      onRemove={jest.fn()}
      onRevoke={jest.fn()}
    />,
  );
}

describe("EventParticipantsPanel", () => {
  it("shows a role chip for the organizer and co-host, not for a participant", async () => {
    await show(NO_PERMISSIONS);

    expect(screen.getByTestId("event-participant-role-jag")).toHaveTextContent("Arrangör");
    expect(screen.getByTestId("event-participant-role-bertil")).toHaveTextContent("Medarrangör");
    expect(screen.queryByTestId("event-participant-role-cissi")).toBeNull();
  });

  it("gives the organizer no menu while others can be managed", async () => {
    await show({ ...NO_PERMISSIONS, canChangeRoles: true, canRemoveParticipants: true });

    expect(screen.queryByTestId("event-participant-menu-jag")).toBeNull();
    expect(screen.getByTestId("event-participant-menu-bertil")).toBeTruthy();
    expect(screen.getByTestId("event-participant-menu-cissi")).toBeTruthy();
  });

  // keep-comment: the API refuses a co-host removing another co-host, so the menu must not offer it
  it("lets a co-host manage participants but not another co-host", async () => {
    await show(
      { ...NO_PERMISSIONS, canRemoveParticipants: true },
      {
        ...PARTICIPANTS,
        participants: [
          { userIdentifier: "o", nickName: "olle", role: "Organizer", joinedAt: "2026-10-01T10:00:00Z" },
          { userIdentifier: "me", nickName: "jag", role: "CoHost", joinedAt: "2026-10-02T10:00:00Z" },
          { userIdentifier: "u2", nickName: "bertil", role: "CoHost", joinedAt: "2026-10-02T11:00:00Z" },
          { userIdentifier: "u3", nickName: "cissi", role: "Participant", joinedAt: "2026-10-03T10:00:00Z" },
        ],
      },
    );

    expect(screen.queryByTestId("event-participant-menu-olle")).toBeNull();
    expect(screen.queryByTestId("event-participant-menu-jag")).toBeNull();
    expect(screen.queryByTestId("event-participant-menu-bertil")).toBeNull();
    expect(screen.getByTestId("event-participant-menu-cissi")).toBeTruthy();
  });

  it("shows the first page of a long list and grows it a page per press until all are shown", async () => {
    const total = PARTICIPANTS_PAGE * 2 + 3;
    const many = Array.from({ length: total }, (_, i) => ({
      userIdentifier: `u${i}`,
      nickName: `deltagare${i}`,
      role: i === 0 ? ("Organizer" as const) : ("Participant" as const),
      joinedAt: "2026-10-01T10:00:00Z",
    }));
    await show(NO_PERMISSIONS, { ...PARTICIPANTS, participantCount: total, participants: many });

    expect(screen.getByTestId("event-participant-deltagare0")).toBeTruthy();
    expect(screen.getByTestId(`event-participant-deltagare${PARTICIPANTS_PAGE - 1}`)).toBeTruthy();
    expect(screen.queryByTestId(`event-participant-deltagare${PARTICIPANTS_PAGE}`)).toBeNull();
    expect(screen.getByTestId("event-participants-more")).toHaveTextContent(
      `Visa fler (${total - PARTICIPANTS_PAGE} till)`,
    );

    await fireEvent.press(screen.getByTestId("event-participants-more"));
    expect(screen.getByTestId(`event-participant-deltagare${PARTICIPANTS_PAGE * 2 - 1}`)).toBeTruthy();
    expect(screen.getByTestId("event-participants-more")).toHaveTextContent("Visa fler (3 till)");

    await fireEvent.press(screen.getByTestId("event-participants-more"));
    expect(screen.getByTestId(`event-participant-deltagare${total - 1}`)).toBeTruthy();
    expect(screen.queryByTestId("event-participants-more")).toBeNull();
  });

  describe("invitations", () => {
    const INVITED: EventParticipants = {
      ...PARTICIPANTS,
      invited: [
        { userIdentifier: "i1", nickName: "dagny", invitedByNickName: "jag", invitedAt: "2026-10-04T10:00:00Z" },
        { userIdentifier: "i2", nickName: "erik", invitedByNickName: "bertil", invitedAt: "2026-10-04T11:00:00Z" },
      ],
    };
    const revokeButton = (nickName: string) => screen.queryByLabelText(`Dra tillbaka inbjudan till ${nickName}`);

    it("lets a participant who may invite revoke only the invitations they sent", async () => {
      await show({ ...NO_PERMISSIONS, canInvite: true }, INVITED);

      expect(screen.getByTestId("event-invitee-erik")).toBeTruthy();
      expect(revokeButton("dagny")).toBeTruthy();
      expect(revokeButton("erik")).toBeNull();
    });

    it("lets a host revoke every invitation", async () => {
      await show({ ...NO_PERMISSIONS, canInvite: true, canPinOrDeletePosts: true }, INVITED);

      expect(revokeButton("dagny")).toBeTruthy();
      expect(revokeButton("erik")).toBeTruthy();
    });
  });

  it("tells a host that a removal can be undone by inviting again, with no 'cannot be undone' warning", async () => {
    await show({ ...NO_PERMISSIONS, canChangeRoles: true, canRemoveParticipants: true });

    await fireEvent.press(screen.getByTestId("event-participant-menu-cissi"));
    await fireEvent.press(screen.getByText("Ta bort från evenemanget"));

    expect(screen.getByText(/du kan bjuda in personen igen/)).toBeTruthy();
    expect(screen.queryByTestId("event-remove-participant-dialog-warning")).toBeNull();
  });

  it("offers no 'show more' when everyone fits on the first page", async () => {
    await show(NO_PERMISSIONS);

    expect(screen.queryByTestId("event-participants-more")).toBeNull();
  });
});
