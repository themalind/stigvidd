// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using WebDataContracts.RequestModels.MailTemplate;

namespace UnitTests.ServiceTests;

/// <summary>
/// The two ways an operator can break mail, which are NOT symmetric and must not be treated
/// the same way:
///
///   adding a placeholder the caller does not supply  -> the render fails, nothing is ever
///                                                       sent, so the save is REFUSED
///   removing one the caller does supply              -> renders fine, but the mail is
///                                                       useless, so it is ALLOWED and the
///                                                       response reports it
/// </summary>
public class MailTemplateAdminServiceTests
{
    private const string Identifier = "c4b9e7a1-6d52-4f83-9b0e-2a7c8d1f5e46";

    private static MailTemplate VerifyEmail() => new()
    {
        Identifier = Identifier,
        Key = "verify-email",
        Language = "sv",
        Subject = "Bekräfta din e-postadress",
        BodyHtml = "<p>Hej {{NickName}},</p><p><a href=\"{{VerificationUrl}}\">Bekräfta</a></p><p>{{VerificationCode}}</p>",
        BodyText = "Hej {{NickName}}, {{VerificationUrl}} {{VerificationCode}}",
    };

    private static Mock<IMailTemplateRepository> RepoWith(MailTemplate template)
    {
        var repo = new Mock<IMailTemplateRepository>();

        repo.Setup(r => r.GetByIdentifierAsync(template.Identifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MailTemplate>.Success(template));

        repo.Setup(r => r.UpdateAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string _, string subject, string html, string text, string? description, CancellationToken _) =>
            {
                template.Subject = subject;
                template.BodyHtml = html;
                template.BodyText = text;
                template.Description = description;
                return RepositoryResult<MailTemplate>.Success(template);
            });

        return repo;
    }

    private static MailTemplateAdminService Build(Mock<IMailTemplateRepository> repo)
    {
        var renderer = new MailTemplateRenderer();

        return new MailTemplateAdminService(
            repo.Object,
            new MailTemplateCatalog(),
            renderer,
            new MailTemplateResponseFactory(renderer),
            NullLogger<MailTemplateAdminService>.Instance);
    }

    private static UpdateMailTemplateRequest Update(string subject, string html, string text) =>
        new() { Subject = subject, BodyHtml = html, BodyText = text };

    [Fact]
    public async Task Update_WhenTheCopyUsesAPlaceholderTheCallerDoesNotSupply_IsRefusedAndNamesIt()
    {
        // Arrange - a plausible typo of NickName.
        var repo = RepoWith(VerifyEmail());

        var request = Update(
            "Bekräfta din e-postadress",
            "<p>Hej {{NickNmae}},</p>",
            "Hej {{NickNmae}},");

        // Act
        var result = await Build(repo).UpdateAsync(Identifier, request, TestContext.Current.CancellationToken);

        // Assert - refused, because this template would fail to render and the mail would
        // simply never arrive. For verify-email that is nobody being able to register.
        result.IsFailure.Should().BeTrue();
        result.Message!.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Contain("{{NickNmae}}");

        repo.Verify(r => r.UpdateAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never,
            "nothing may be written when the copy would stop the mail");
    }

    [Fact]
    public async Task Update_WhenTheCopyDropsAPlaceholderTheCallerSupplies_IsAllowedAndReportsIt()
    {
        // Arrange - the verification link is gone. This renders perfectly well: the renderer
        // ignores model keys a template does not use. It is simply a useless mail, which is a
        // judgement for the operator rather than for the API.
        var repo = RepoWith(VerifyEmail());

        var request = Update(
            "Bekräfta din e-postadress",
            "<p>Hej {{NickName}}, koden är {{VerificationCode}}</p>",
            "Hej {{NickName}}, koden är {{VerificationCode}}");

        // Act
        var result = await Build(repo).UpdateAsync(Identifier, request, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value!.MissingTokens.Should().Contain("VerificationUrl");
        result.Value.UnknownTokens.Should().BeEmpty();
    }

    [Fact]
    public async Task Update_MatchesPlaceholderNamesCaseInsensitively()
    {
        // The renderer looks the model up with OrdinalIgnoreCase, so {{nickname}} really does
        // substitute. Refusing it here would refuse something that works.
        var repo = RepoWith(VerifyEmail());

        var request = Update("Hej", "<p>{{nickname}}</p>", "{{NICKNAME}}");

        var result = await Build(repo).UpdateAsync(Identifier, request, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task Update_ChecksTheSubjectAsWellAsTheBodies()
    {
        // The seeded "welcome" subject is "Välkommen till Stigvidd, {{NickName}}!", so the
        // subject is a real place for a token -- and a bad one there stops the mail just the
        // same, because Render substitutes all three parts.
        var repo = RepoWith(VerifyEmail());

        var request = Update("Hej {{Nonsense}}", "<p>{{NickName}}</p>", "{{NickName}}");

        var result = await Build(repo).UpdateAsync(Identifier, request, TestContext.Current.CancellationToken);

        result.IsFailure.Should().BeTrue();
        result.Message!.ResultMessage.Should().Contain("{{Nonsense}}");
    }

    [Fact]
    public async Task Update_ForAKeyNoCallerDeclares_DoesNotCondemnEveryPlaceholderInIt()
    {
        // An orphaned row: we do not know what its caller passes, so calling everything in it
        // unknown would make it uneditable and tell the operator something untrue.
        var orphan = VerifyEmail();
        orphan.Key = "some-template-nothing-declares";

        var repo = RepoWith(orphan);

        var request = Update("Hej", "<p>{{Whatever}}</p>", "{{Whatever}}");

        var result = await Build(repo).UpdateAsync(Identifier, request, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Value!.Purpose.Should().BeNull();
        result.Value.UnknownTokens.Should().BeEmpty();

        // The distinction the editor needs: no token list because nothing declares this key,
        // as opposed to a declared key that takes no placeholders. Without it the editor
        // condemns every placeholder in an orphaned row and refuses to save it.
        result.Value.IsKnown.Should().BeFalse();
        result.Value.Tokens.Should().BeEmpty();
    }

    [Fact]
    public async Task Update_SavesExactlyTheFieldsItWasGiven_AndNeverTheKeyOrLanguage()
    {
        var repo = RepoWith(VerifyEmail());

        var request = new UpdateMailTemplateRequest
        {
            Subject = "Ny rubrik {{NickName}}",
            BodyHtml = "<p>Ny text {{NickName}}</p>",
            BodyText = "Ny text {{NickName}}",
            Description = "Uppdaterad.",
        };

        var result = await Build(repo).UpdateAsync(Identifier, request, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        repo.Verify(r => r.UpdateAsync(
            Identifier, request.Subject, request.BodyHtml, request.BodyText, request.Description,
            It.IsAny<CancellationToken>()), Times.Once);

        // Key and Language identify the calling code. The repository signature does not even
        // accept them, which is the point.
        result.Value!.Key.Should().Be("verify-email");
        result.Value.Language.Should().Be("sv");
    }

    [Fact]
    public async Task Update_WhenTheTemplateDoesNotExist_IsNotFound()
    {
        var repo = new Mock<IMailTemplateRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<MailTemplate>.NotFound());

        var result = await Build(repo).UpdateAsync("nope", Update("s", "<p>h</p>", "t"), TestContext.Current.CancellationToken);

        result.IsFailure.Should().BeTrue();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task Preview_RendersTheDraftWithTheCatalogueSamples_WithoutSavingAnything()
    {
        var repo = RepoWith(VerifyEmail());

        var request = new PreviewMailTemplateRequest
        {
            Subject = "Hej {{NickName}}",
            BodyHtml = "<p>Hej {{NickName}}</p><p><a href=\"{{VerificationUrl}}\">Bekräfta</a></p>",
            BodyText = "Hej {{NickName}} {{VerificationCode}}",
        };

        var result = await Build(repo).PreviewAsync(Identifier, request, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        result.Value!.Subject.Should().Be("Hej Ralf");
        result.Value.BodyHtml.Should().Contain("Hej Ralf");
        result.Value.BodyHtml.Should().Contain("https://stigvidd.se/api/v1/Account/verify-email?token=");
        result.Value.BodyText.Should().Contain("402913");

        repo.Verify(r => r.UpdateAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Preview_WhenTheDraftWouldFailToSend_FailsTheSameWayAndBeforeAnythingIsSaved()
    {
        // The value of previewing through the production renderer rather than a preview-only
        // path: the operator meets the enqueue-time failure while still editing.
        var repo = RepoWith(VerifyEmail());

        var request = new PreviewMailTemplateRequest
        {
            Subject = "Hej",
            BodyHtml = "<p>Hej {{NickNmae}}</p>",
            BodyText = "Hej",
        };

        var result = await Build(repo).PreviewAsync(Identifier, request, TestContext.Current.CancellationToken);

        result.IsFailure.Should().BeTrue();
        result.Message!.StatusCode.Should().Be(400);
        result.Message.ResultMessage.Should().Contain("NickNmae");
    }

    [Fact]
    public async Task Get_ReportsWhichDeclaredTokensTheCopyActuallyUses()
    {
        var template = VerifyEmail();
        template.BodyHtml = "<p>Hej {{NickName}}</p>";
        template.BodyText = "Hej {{NickName}}";
        template.Subject = "Hej";

        var result = await Build(RepoWith(template)).GetAsync(Identifier, TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();

        var tokens = result.Value!.Tokens.ToDictionary(token => token.Name, token => token.IsUsed);
        tokens["NickName"].Should().BeTrue();
        tokens["VerificationUrl"].Should().BeFalse();
        tokens["VerificationCode"].Should().BeFalse();

        result.Value.MissingTokens.Should().BeEquivalentTo(["VerificationUrl", "VerificationCode"]);
        result.Value.Purpose.Should().NotBeNullOrWhiteSpace();
        result.Value.IsKnown.Should().BeTrue();
    }
}
