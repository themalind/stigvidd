// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Event;

// What the caller may do, straight from EventMembership, so the app never re-derives a rule. keep-comment: one source for the rights table
public class EventPermissionsResponse
{
    public bool CanEdit { get; set; }
    public bool CanCancel { get; set; }
    public bool CanDelete { get; set; }
    public bool CanInvite { get; set; }
    public bool CanJoin { get; set; }
    public bool CanMarkInterested { get; set; }
    public bool CanChangeRoles { get; set; }
    public bool CanRemoveParticipants { get; set; }
    public bool CanPinOrDeletePosts { get; set; }
    public bool CanReadBoard { get; set; }
    public bool CanPost { get; set; }
}
