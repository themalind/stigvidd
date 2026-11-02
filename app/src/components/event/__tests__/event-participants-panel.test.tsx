// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import EventParticipantsPanel from "@/components/event/event-participants-panel";
import { EventParticipants, EventPermissions } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

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

function show(permissions: EventPermissions) {
  renderWithProviders(
    <EventParticipantsPanel
      participants={PARTICIPANTS}
      permissions={permissions}
      myNickName="jag"
      onSetRole={jest.fn()}
      onRemove={jest.fn()}
      onRevoke={jest.fn()}
    />,
  );
}

describe("EventParticipantsPanel", () => {
  it("shows a role chip for the organizer and co-host, not for a participant", () => {
    show(NO_PERMISSIONS);

    expect(screen.getByTestId("event-participant-role-jag")).toHaveTextContent("Arrangör");
    expect(screen.getByTestId("event-participant-role-bertil")).toHaveTextContent("Medarrangör");
    expect(screen.queryByTestId("event-participant-role-cissi")).toBeNull();
  });

  it("gives the organizer no menu while others can be managed", () => {
    show({ ...NO_PERMISSIONS, canChangeRoles: true, canRemoveParticipants: true });

    expect(screen.queryByTestId("event-participant-menu-jag")).toBeNull();
    expect(screen.getByTestId("event-participant-menu-bertil")).toBeTruthy();
    expect(screen.getByTestId("event-participant-menu-cissi")).toBeTruthy();
  });
});
