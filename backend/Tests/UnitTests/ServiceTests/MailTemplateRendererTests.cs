// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Services;
using Infrastructure.Data.Entities;

namespace UnitTests.ServiceTests;

public class MailTemplateRendererTests
{
    private static MailTemplateRenderer Build() => new();

    private static MailTemplate MakeTemplate(
        string subject = "Hej {{NickName}}",
        string html = "<p>Hej {{NickName}}</p>",
        string text = "Hej {{NickName}}") =>
        new()
        {
            Key = "welcome",
            Language = "sv",
            Subject = subject,
            BodyHtml = html,
            BodyText = text,
        };

    [Fact]
    public void Render_WhenModelHasEveryPlaceholder_SubstitutesAllThreeParts()
    {
        // Arrange
        var template = MakeTemplate();
        var model = new Dictionary<string, string?> { ["NickName"] = "Ralf" };

        // Act
        var result = Build().Render(template, model);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Subject.Should().Be("Hej Ralf");
        result.Value.BodyHtml.Should().Be("<p>Hej Ralf</p>");
        result.Value.BodyText.Should().Be("Hej Ralf");
    }

    [Fact]
    public void Render_WhenAPlaceholderIsRepeated_SubstitutesEveryOccurrence()
    {
        // Arrange
        var template = MakeTemplate(text: "Hej {{NickName}}. Vi ses, {{NickName}}!");
        var model = new Dictionary<string, string?> { ["NickName"] = "Ralf" };

        // Act
        var result = Build().Render(template, model);

        // Assert
        result.Value!.BodyText.Should().Be("Hej Ralf. Vi ses, Ralf!");
    }

    [Fact]
    public void Render_WhenThePlaceholderHasInnerWhitespace_IsStillSubstituted()
    {
        // Arrange
        var template = MakeTemplate(text: "Hej {{  NickName  }}");
        var model = new Dictionary<string, string?> { ["NickName"] = "Ralf" };

        // Act
        var result = Build().Render(template, model);

        // Assert
        result.Value!.BodyText.Should().Be("Hej Ralf");
    }

    [Fact]
    public void Render_WhenTheModelKeyDiffersInCase_IsStillSubstituted()
    {
        // Arrange
        var template = MakeTemplate(text: "Hej {{NickName}}");
        var model = new Dictionary<string, string?> { ["nickname"] = "Ralf" };

        // Act
        var result = Build().Render(template, model);

        // Assert
        result.Value!.BodyText.Should().Be("Hej Ralf");
    }

    [Fact]
    public void Render_WhenTheModelIsMissingAPlaceholder_FailsAndNamesIt()
    {
        // Arrange - the caller forgot TrailName entirely.
        var template = MakeTemplate(text: "Hej {{NickName}}, se {{TrailName}}");
        var model = new Dictionary<string, string?> { ["NickName"] = "Ralf" };

        // Act
        var result = Build().Render(template, model);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Contain("TrailName");
    }

    [Fact]
    public void Render_WhenAValueIsNull_RendersEmptyRatherThanFailing()
    {
        // Arrange - the key is present, so the caller knows it exists and has no value.
        var template = MakeTemplate(text: "Hej {{NickName}}!");
        var model = new Dictionary<string, string?> { ["NickName"] = null };

        // Act
        var result = Build().Render(template, model);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.BodyText.Should().Be("Hej !");
    }

    [Fact]
    public void Render_WhenAValueContainsMarkup_EncodesItInHtmlButNotInText()
    {
        // Arrange - an unencoded value in the HTML part is markup injection, and at minimum
        // breaks the mail. The text part must stay literal.
        var template = MakeTemplate(
            subject: "Hej {{NickName}}",
            html: "<p>Hej {{NickName}}</p>",
            text: "Hej {{NickName}}");
        var model = new Dictionary<string, string?> { ["NickName"] = "<script>alert('x')</script>" };

        // Act
        var result = Build().Render(template, model);

        // Assert
        result.Value!.BodyHtml.Should().NotContain("<script>");
        result.Value.BodyHtml.Should().Be("<p>Hej &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;</p>");
        result.Value.BodyText.Should().Be("Hej <script>alert('x')</script>");
    }

    [Fact]
    public void Render_WhenAValueContainsNewlines_StripsThemFromTheSubjectOnly()
    {
        // Arrange - a newline in a subject lets everything after it be read as a new SMTP
        // header. The body is not a header and keeps its newlines.
        var template = MakeTemplate(
            subject: "Hej {{NickName}}",
            text: "Hej {{NickName}}");
        var model = new Dictionary<string, string?> { ["NickName"] = "Ralf\r\nBcc: someone@example.com" };

        // Act
        var result = Build().Render(template, model);

        // Assert
        result.Value!.Subject.Should().NotContain("\r").And.NotContain("\n");
        result.Value.Subject.Should().Be("Hej Ralf  Bcc: someone@example.com");
        result.Value.BodyText.Should().Contain("\r\n");
    }

    [Fact]
    public void Render_WhenTheModelHasKeysTheTemplateDoesNotUse_IgnoresThem()
    {
        // Arrange
        var template = MakeTemplate(text: "Hej {{NickName}}");
        var model = new Dictionary<string, string?> { ["NickName"] = "Ralf", ["Unused"] = "x" };

        // Act
        var result = Build().Render(template, model);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.BodyText.Should().Be("Hej Ralf");
    }

    [Fact]
    public void ExtractPlaceholders_ReturnsEachNameOnce()
    {
        // Act
        var names = Build().ExtractPlaceholders("{{NickName}} {{ TrailName }} {{NickName}}");

        // Assert
        names.Should().BeEquivalentTo(["NickName", "TrailName"]);
    }
}
