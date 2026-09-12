// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace StigviddAPI.Controllers;

/// <summary>
/// The four pages the verification link can land on. Self-contained by necessity: this is
/// rendered from a mail client's browser with no session, no app shell and often no network
/// beyond the one request, so there is nothing external to reference.
/// </summary>
internal static class VerificationPage
{
    public static string Verified => Page(
        "E-postadressen är verifierad",
        "Ditt konto är klart. Öppna Stigvidd och logga in.",
        ok: true);

    public static string Expired => Page(
        "Länken har gått ut",
        "Verifieringslänken är inte giltig längre. Begär en ny från appen så skickar vi ett nytt mejl.",
        ok: false);

    public static string Invalid => Page(
        "Länken fungerar inte",
        "Vi känner inte igen den här verifieringslänken. Kontrollera att du öppnade hela länken från mejlet, eller begär ett nytt från appen.",
        ok: false);

    public static string Error => Page(
        "Något gick fel",
        "Vi kunde inte verifiera adressen just nu. Försök igen om en stund.",
        ok: false);

    // $$""" so that the CSS keeps its own single braces: with one $ every '{' would open an
    // interpolation hole. Holes are therefore {{expr}}, and no literal '{{' or '}}' may appear.
    private static string Page(string heading, string body, bool ok) =>
        $$"""
        <!doctype html>
        <html lang="sv">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
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
          @media (prefers-color-scheme: dark) {
            body { background: #101410; color: #e2e3dd; }
            .card { background: #1b201b; box-shadow: none; }
            p { color: #c2c8bc; }
          }
        </style>
        </head>
        <body>
          <main class="card">
            <div class="mark" aria-hidden="true">{{(ok ? "&#10003;" : "!")}}</div>
            <h1>{{heading}}</h1>
            <p>{{body}}</p>
          </main>
        </body>
        </html>
        """;
}
