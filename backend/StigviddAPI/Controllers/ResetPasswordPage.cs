// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Net;

namespace StigviddAPI.Controllers;

/// <summary>
/// The pages the password-reset link can land on, including the form itself. Self-contained by
/// necessity, exactly as <see cref="VerificationPage"/> is: this is rendered from a mail
/// client's browser with no session, no app shell and often no network beyond the one request,
/// so there is nothing external to reference.
/// </summary>
internal static class ResetPasswordPage
{
    /// <summary>
    /// The form. <paramref name="rawToken"/> is carried in a hidden field rather than left in
    /// the query string of the POST, and the page asks for no referrer, so the secret does not
    /// travel onward in a Referer header.
    /// </summary>
    public static string Form(string rawToken, string? error = null)
    {
        // Built here rather than inline in the template: a raw string nested inside an
        // interpolation hole of another raw string is legal but easy to break on the next edit.
        var errorHtml = error is null
            ? string.Empty
            : $"<p class=\"error\" role=\"alert\">{WebUtility.HtmlEncode(error)}</p>";

        // The token is base64url and so already safe, but it is encoded anyway: nothing
        // reaching an attribute from a query string should depend on its own shape.
        var token = WebUtility.HtmlEncode(rawToken);

        var form = $"""
            {errorHtml}
            <form method="post" action="/api/v1/account/reset-password">
              <input type="hidden" name="token" value="{token}">
              <label for="p1">Nytt lösenord</label>
              <input id="p1" type="password" name="newPassword" autocomplete="new-password" required autofocus>
              <label for="p2">Upprepa lösenordet</label>
              <input id="p2" type="password" name="confirmPassword" autocomplete="new-password" required>
              <button type="submit">Byt lösenord</button>
            </form>
            """;

        return Page("Välj ett nytt lösenord", null, mark: "&#128273;", ok: true, bodyHtml: form);
    }

    public static string Done => Page(
        "Lösenordet är ändrat",
        "Du kan nu logga in i Stigvidd med ditt nya lösenord.",
        ok: true);

    public static string Expired => Page(
        "Länken har gått ut",
        "Återställningslänken är inte giltig längre - den gäller i två timmar och kan bara användas en gång. Begär en ny från appen så skickar vi ett nytt mejl.",
        ok: false);

    public static string Invalid => Page(
        "Länken fungerar inte",
        "Vi känner inte igen den här återställningslänken. Kontrollera att du öppnade hela länken från mejlet, eller begär en ny från appen.",
        ok: false);

    public static string Error => Page(
        "Något gick fel",
        "Vi kunde inte ändra lösenordet just nu. Försök igen om en stund.",
        ok: false);

    /// <summary>
    /// What a rejected password says. Deliberately generic: Keycloak answers a policy
    /// violation with one of its own localised message keys, and a raw key is not something to
    /// put in front of a user. The realm owns the rules, so this page cannot enumerate them.
    /// </summary>
    public const string WeakPasswordMessage =
        "Lösenordet uppfyller inte kraven. Välj ett längre lösenord med en blandning av tecken.";

    public const string MismatchMessage = "Lösenorden matchar inte varandra.";

    public const string MissingMessage = "Fyll i båda fälten.";

    // $$""" so that the CSS keeps its own single braces: with one $ every '{' would open an
    // interpolation hole. Holes are therefore {{expr}}, and no literal '{{' or '}}' may appear.
    private static string Page(
        string heading,
        string? body,
        bool ok,
        string? bodyHtml = null,
        string? mark = null) =>
        $$"""
        <!doctype html>
        <html lang="sv">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="referrer" content="no-referrer">
        <title>{{heading}} - Stigvidd</title>
        <style>
          :root { color-scheme: light dark; }
          body {
            margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
            padding: 24px; box-sizing: border-box;
            font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            background: #f4f6f4; color: #1a1c19;
          }
          .card {
            background: #fff; border-radius: 12px; padding: 32px; max-width: 26rem; width: 100%;
            box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.08); text-align: center;
          }
          .mark {
            width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 20px;
            display: flex; align-items: center; justify-content: center;
            font-size: 28px; line-height: 1; color: #fff;
            background: {{(ok ? "#3f6b43" : "#8a4b42")}};
          }
          h1 { font-size: 1.35rem; margin: 0 0 12px; }
          p { margin: 0; color: #43483f; }
          form { margin: 20px 0 0; text-align: left; }
          label { display: block; font-size: .9rem; font-weight: 600; margin: 12px 0 4px; }
          input[type=password] {
            width: 100%; box-sizing: border-box; padding: 10px 12px; font-size: 1rem;
            border: 1px solid #c2c8bc; border-radius: 8px; background: #fff; color: #1a1c19;
          }
          button {
            width: 100%; margin-top: 20px; padding: 12px 20px; font-size: 1rem; font-weight: 600;
            border: 0; border-radius: 8px; background: #3f6b43; color: #fff; cursor: pointer;
          }
          .error {
            margin: 0 0 4px; padding: 10px 12px; border-radius: 8px;
            background: #f7e3e1; color: #8a4b42; font-size: .95rem; text-align: left;
          }
          @media (prefers-color-scheme: dark) {
            body { background: #101410; color: #e2e3dd; }
            .card { background: #1b201b; box-shadow: none; }
            p { color: #c2c8bc; }
            input[type=password] { background: #101410; color: #e2e3dd; border-color: #43483f; }
            .error { background: #3a2523; color: #f0c4be; }
          }
        </style>
        </head>
        <body>
          <main class="card">
            <div class="mark" aria-hidden="true">{{mark ?? (ok ? "&#10003;" : "!")}}</div>
            <h1>{{heading}}</h1>
            {{(body is null ? "" : $"<p>{body}</p>")}}
            {{bodyHtml ?? ""}}
          </main>
        </body>
        </html>
        """;
}
