// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;

namespace Core.Services;

// The token descriptions the admin editor puts in front of an operator. Adding a token to a
// mail means adding it BOTH at the call site and here -- MailTemplateCatalogTests fails
// otherwise, which is the point: a catalogue that can drift is no better than the prose in
// MailTemplate.Description that it replaces. See docs/mail.md, "Editing the wording".
public class MailTemplateCatalog : IMailTemplateCatalog
{
    // Sample values are only ever rendered into a preview, never sent. They are chosen to
    // look like the real thing so an operator can judge line lengths and wrapping.
    private static readonly MailTemplateToken NickName = new(
        "NickName",
        "Nickname",
        "The name the recipient chose when they signed up.",
        "Ralf");

    private static readonly IReadOnlyList<MailTemplateDefinition> Definitions =
    [
        new MailTemplateDefinition(
            "welcome",
            "Sent once a registration has succeeded and the verification mail is safely "
                + "queued. It carries nothing the user has to act on -- the verify-email mail "
                + "is the one that does -- so it is the one mail here that can fail to send "
                + "without costing anybody access to their account.",
            [NickName]),

        new MailTemplateDefinition(
            "verify-email",
            "Sent the moment somebody registers. It carries the only link and code that can "
                + "enable the account, so until this mail arrives and is acted on, the user "
                + "cannot log in at all.",
            [
                NickName,
                new MailTemplateToken(
                    "VerificationUrl",
                    "Verification link",
                    "The one-time URL that confirms the address and enables the account. "
                        + "Valid for 24 hours.",
                    "https://stigvidd.se/api/v1/Account/verify-email?token=3f9a1c7e5b2d48a6"),
                new MailTemplateToken(
                    "VerificationCode",
                    "Verification code",
                    "The six-digit code that does the same thing as the link, for somebody "
                        + "typing it into the app instead.",
                    "402913"),
            ]),

        new MailTemplateDefinition(
            "reset-password",
            "Sent when somebody asks to reset a forgotten password. It carries the only link "
                + "that can set a new one, and that link is valid for two hours -- so wording "
                + "that delays the recipient is worse here than in any other template.",
            [
                NickName,
                new MailTemplateToken(
                    "ResetUrl",
                    "Reset link",
                    "The one-time URL that opens the page where a new password is chosen. "
                        + "Valid for two hours, and spent as soon as a password is set.",
                    "https://stigvidd.se/api/v1/account/reset-password?token=8c2e4b6a9d1f37e5"),
            ]),
    ];

    public IReadOnlyList<MailTemplateDefinition> All => Definitions;

    // Keys are matched the way the renderer matches placeholders, so a caller writing
    // "Verify-Email" against "verify-email" is not a puzzle.
    public MailTemplateDefinition? Find(string key) =>
        Definitions.FirstOrDefault(d => string.Equals(d.Key, key, StringComparison.OrdinalIgnoreCase));
}
