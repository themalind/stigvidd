// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Enums;

// How sure the sync is that a feature belongs to the trail it was matched against.
// Ascending, so a threshold reads as Confidence >= MatchConfidence.High, and the default
// value is the one that sends a link to the review queue rather than past it.
public enum MatchConfidence
{
    Unmatched = 0,  // no trail found
    Medium = 1,     // plausible, needs a human
    High = 2,       // strong spatial overlap
    Certain = 3,    // identical geometry fingerprint
}

// Do not change the values of the enum as they are used in the database and changing them would break existing data.
