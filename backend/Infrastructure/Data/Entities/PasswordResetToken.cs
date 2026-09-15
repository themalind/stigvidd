// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// One outstanding "set a new password" challenge. A user has at most one live row: issuing a
// new one consumes the previous, so a second "forgot password" retires the first link.
//
// Deliberately narrower than EmailVerificationToken, which it otherwise mirrors. There is no
// six-digit code half and therefore no Attempts cap: the link token is 256 bits of CSPRNG
// output, so there is nothing here a brute force could reach and nothing to rate-limit.
//
// The token is stored only as a hash. The raw value exists solely in the mail that was sent,
// so a leaked database dump cannot be used to take over an account.
public class PasswordResetToken : BaseEntity
{
    public int UserId { get; set; }
    public User? User { get; set; }

    // SHA-256 of the link token. Unique, because both endpoints look a row up by this alone.
    public required string TokenHash { get; set; }

    public DateTime ExpiresAt { get; set; }

    // Set when the new password has actually been accepted by Keycloak -- NOT when the link
    // is opened. The GET only renders the form; consuming there would let a mail scanner
    // following the link burn it before the human ever sees the page.
    public DateTime? ConsumedAt { get; set; }
}
