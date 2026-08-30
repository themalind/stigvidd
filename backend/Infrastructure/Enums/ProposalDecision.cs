// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// What the reviewer chose for one proposed feature. Pending is the default, so an
// undecided proposal cannot be mistaken for an approved one.
public enum ProposalDecision
{
    Pending = 0,
    Accept = 1,      // keep the suggested trail
    Relink = 2,      // point it at a different trail
    CreateNew = 3,   // no trail fits; make one
    Exclude = 4,     // never publish this feature
    Skip = 5,        // leave it for a later session
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
