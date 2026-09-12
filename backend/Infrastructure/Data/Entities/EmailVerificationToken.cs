// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// One outstanding "prove you own this address" challenge, issued at registration and again on
// every resend. A user has at most one live row: issuing a new one consumes the previous.
//
// Both secrets are stored as hashes. The raw token and the raw code exist only in the mail that
// was sent, so a leaked database dump cannot be used to verify somebody else's address.
public class EmailVerificationToken : BaseEntity
{
    public int UserId { get; set; }
    public User? User { get; set; }

    // SHA-256 of the link token. Unique, because the GET endpoint looks a row up by this alone.
    public required string TokenHash { get; set; }

    // SHA-256 of the six-digit code. Never looked up on its own — the caller supplies an email,
    // and the code is only compared against that user's row. Six digits is not enough entropy
    // to be a lookup key, which is what Attempts below exists to bound.
    public required string CodeHash { get; set; }

    public DateTime ExpiresAt { get; set; }

    // Set when the challenge is met. A consumed row is kept rather than deleted so a second
    // click on the same link can still be told "already verified" instead of "invalid".
    public DateTime? ConsumedAt { get; set; }

    // Wrong codes tried against this row. Past MaxCodeAttempts the row is dead and the user
    // has to ask for a new mail; it is the only thing standing between a six-digit code and
    // a million guesses.
    public int Attempts { get; set; }
}
