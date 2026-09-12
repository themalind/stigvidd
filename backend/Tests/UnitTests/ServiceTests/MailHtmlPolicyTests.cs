// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;

namespace UnitTests.ServiceTests;

/// <summary>
/// The gate between an operator's markup and everybody's inbox. MailTemplate.BodyHtml is
/// emitted verbatim -- nothing downstream filters it -- so the save is the only moment
/// anything looks at it.
/// </summary>
public class MailHtmlPolicyTests
{
    // The body seeded by the AddEmailVerification migration. If the policy ever rejects this,
    // the policy is wrong: it is the markup the project itself ships.
    private const string SeededVerifyEmailBody =
        "<p>Hej {{NickName}},</p>\n"
        + "<p>Tack för att du skapade ett konto hos Stigvidd. Klicka på knappen för att bekräfta din e-postadress, så kan du logga in.</p>\n"
        + "<p><a href=\"{{VerificationUrl}}\" style=\"display:inline-block;padding:12px 20px;border-radius:8px;background:#3f6b43;color:#ffffff;text-decoration:none\">Bekräfta e-postadressen</a></p>\n"
        + "<p>Fungerar inte knappen? Kopiera den här länken till din webbläsare:<br>\n"
        + "<a href=\"{{VerificationUrl}}\">{{VerificationUrl}}</a></p>\n"
        + "<p>Du kan också skriva in den här koden i appen:</p>\n"
        + "<p style=\"font-size:28px;letter-spacing:6px;font-weight:700\">{{VerificationCode}}</p>\n"
        + "<p>Länken och koden gäller i 24 timmar. Om det inte var du som skapade kontot kan du strunta i det här mejlet.</p>";

    [Fact]
    public void TheTemplateTheProjectShips_IsAccepted()
    {
        MailHtmlPolicy.Check(SeededVerifyEmailBody).Should().BeEmpty();
    }

    [Fact]
    public void AnInlineStyledButton_IsAccepted()
    {
        // Inline CSS is how mail is styled; a policy that refused it would refuse all email.
        var html = "<a href=\"https://stigvidd.se\" style=\"display:inline-block;padding:12px 20px\">Go</a>";

        MailHtmlPolicy.Check(html).Should().BeEmpty();
    }

    [Fact]
    public void AScriptTag_IsRejectedAndNamed()
    {
        var violations = MailHtmlPolicy.Check("<p>hi</p><script>alert(1)</script>");

        violations.Should().ContainSingle().Which.Should().Contain("<script>");
    }

    [Theory]
    [InlineData("<iframe src=\"https://x.test\"></iframe>", "<iframe>")]
    [InlineData("<form action=\"https://x.test\"></form>", "<form>")]
    [InlineData("<style>p{color:red}</style>", "<style>")]
    [InlineData("<object data=\"x\"></object>", "<object>")]
    public void TagsOutsideTheAllowlist_AreRejected(string html, string expected)
    {
        MailHtmlPolicy.Check(html).Should().Contain(violation => violation.Contains(expected));
    }

    [Fact]
    public void AnEventHandler_IsRejectedAsAnEventHandlerRatherThanAsAnUnknownAttribute()
    {
        // Worth its own message: "that is an event handler" tells the operator why, where
        // "that attribute is not on the list" invites them to ask for it to be added.
        var violations = MailHtmlPolicy.Check("<p onclick=\"steal()\">hi</p>");

        violations.Should().ContainSingle().Which.Should().Contain("event handler");
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("JaVaScRiPt:alert(1)")]
    [InlineData("data:text/html;base64,PHNjcmlwdD4=")]
    [InlineData("vbscript:msgbox")]
    public void ADangerousScheme_IsRejected(string href)
    {
        MailHtmlPolicy.Check($"<a href=\"{href}\">x</a>").Should().NotBeEmpty();
    }

    [Fact]
    public void AnObfuscatedDangerousScheme_IsRejectedByTheAllowlistRatherThanByRecognisingIt()
    {
        // "&#106;avascript:" is "javascript:" to a browser, and "java\tscript:" is too --
        // parsers ignore control characters inside a scheme. Neither is rejected here because
        // the policy spotted the trick: they are rejected because an ALLOWLIST of schemes
        // cannot be smuggled past. Measured: both still fail with the decode and the
        // control-character strip removed. That is the argument for an allowlist over a
        // denylist, and it is worth having a test that states it.
        MailHtmlPolicy.Check("<a href=\"&#106;avascript:alert(1)\">x</a>").Should().NotBeEmpty();
        MailHtmlPolicy.Check("<a href=\"java\tscript:alert(1)\">x</a>").Should().NotBeEmpty();
    }

    [Fact]
    public void AnEntityEncodedLegitimateScheme_IsAccepted()
    {
        // This is what the decode actually buys, and the only behaviour that changes when it
        // is removed: a value whose scheme is entity-encoded still resolves to an allowed one
        // rather than being refused for looking odd.
        MailHtmlPolicy.Check("<a href=\"&#104;ttps://stigvidd.se\">x</a>").Should().BeEmpty();
    }

    [Fact]
    public void AControlCharacterInsideAnAllowedScheme_DoesNotCauseAFalseRejection()
    {
        MailHtmlPolicy.Check("<a href=\"htt\tps://stigvidd.se\">x</a>").Should().BeEmpty();
    }

    [Fact]
    public void APlaceholderAsTheWholeHref_IsAccepted()
    {
        // The verification button depends on exactly this: the scheme arrives with the
        // substituted value, and MailOutboxService renders before anything is sent.
        MailHtmlPolicy.Check("<a href=\"{{VerificationUrl}}\">Verify</a>").Should().BeEmpty();
    }

    [Fact]
    public void AHrefBeginningWithAPlaceholder_IsAccepted()
    {
        MailHtmlPolicy.Check("<a href=\"{{VerificationUrl}}&amp;resend=1\">Verify</a>").Should().BeEmpty();
    }

    [Fact]
    public void ARelativeHref_IsRejectedBecauseItCannotResolveInAMailClient()
    {
        MailHtmlPolicy.Check("<a href=\"/verify\">x</a>").Should().NotBeEmpty();
    }

    [Fact]
    public void ScriptHiddenInsideAComment_IsNotTreatedAsMarkup()
    {
        // Outlook conditional comments are real, so comments pass -- but their contents must
        // not then be scanned, or every conditional would read as a violation.
        MailHtmlPolicy.Check("<p>hi</p><!-- <script>alert(1)</script> -->").Should().BeEmpty();
    }

    [Fact]
    public void TheSameMistakeTwice_IsReportedOnce()
    {
        var violations = MailHtmlPolicy.Check("<script>a</script><script>b</script>");

        violations.Should().ContainSingle();
    }

    [Fact]
    public void EmptyOrPlainText_IsAccepted()
    {
        MailHtmlPolicy.Check(null).Should().BeEmpty();
        MailHtmlPolicy.Check("").Should().BeEmpty();
        MailHtmlPolicy.Check("Hej {{NickName}}").Should().BeEmpty();
    }

    [Fact]
    public void AGreaterThanInsideAnAttributeValue_DoesNotSplitTheTag()
    {
        // The scanner is quote-aware. Without that, "a>b" ends the tag early and the rest of
        // the attribute text is scanned as markup, which reports nonsense.
        MailHtmlPolicy.Check("<a href=\"https://x.test/?q=a%3Eb\" title=\"a > b\">x</a>")
            .Should().BeEmpty();
    }

    [Fact]
    public void ATableLayout_IsAccepted()
    {
        // Still how mail clients do layout, however much one might wish otherwise.
        var html = "<table cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tbody><tr>"
            + "<td bgcolor=\"#3f6b43\" align=\"center\">x</td></tr></tbody></table>";

        MailHtmlPolicy.Check(html).Should().BeEmpty();
    }
}
