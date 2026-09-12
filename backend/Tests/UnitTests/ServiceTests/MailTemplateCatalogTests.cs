// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace UnitTests.ServiceTests;

/// <summary>
/// The catalogue is what the admin editor shows an operator, and what it refuses a save
/// against. It is only worth anything if it says what the calling code actually passes -- a
/// catalogue that has drifted blocks a legitimate placeholder, or waves through one that
/// stops the mail. So the call site is driven for real here and compared against it.
/// </summary>
public class MailTemplateCatalogTests
{
    private static readonly MailTemplateCatalog Catalog = new();

    [Fact]
    public void VerifyEmail_DeclaresExactlyThePlaceholdersTheRealCallerSupplies()
    {
        // Arrange - the real EmailVerificationService, with only the collaborators it needs
        // to get as far as queueing the mail.
        var tokens = new Mock<IEmailVerificationTokenRepository>();
        tokens
            .Setup(repo => repo.ReplaceOutstandingAsync(It.IsAny<Infrastructure.Data.Entities.EmailVerificationToken>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // What the service passed to the outbox, which is the thing under test.
        IReadOnlyDictionary<string, string?>? model = null;

        var outbox = new Mock<IMailOutboxService>();
        outbox
            .Setup(service => service.EnqueueAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, string?>>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<string?>(),
                It.IsAny<string?>()))
            .Callback((string _, string _, IReadOnlyDictionary<string, string?> passed, CancellationToken _, string? _, string? _) => model = passed)
            .ReturnsAsync(Result.Ok("queued"));

        var service = new EmailVerificationService(
            tokens.Object,
            Mock.Of<IKeycloakAdminRepository>(),
            outbox.Object,
            new ConfigurationBuilder().Build(),
            NullLogger<EmailVerificationService>.Instance);

        // Act
        var result = service
            .IssueAndSendAsync(1, "vandrare@example.com", "Ralf", "https://stigvidd.test", CancellationToken.None)
            .GetAwaiter().GetResult();

        // Assert
        result.Success.Should().BeTrue();
        model.Should().NotBeNull("the verification mail must have been queued for this test to mean anything");

        var declared = Catalog.Find(EmailVerificationService.TemplateKey)!.Tokens.Select(token => token.Name);

        model.Keys.Should().BeEquivalentTo(
            declared,
            "the catalogue is what the editor offers and validates against -- a name here that "
                + "the caller does not pass is a placeholder the editor would allow into a "
                + "template, and every one of those mails then fails to render");
    }

    [Fact]
    public void EveryTemplateKeyThatCodeSends_IsDescribed()
    {
        // The one key with a production caller. "welcome" is deliberately not asserted here:
        // nothing sends it, which is a fact the catalogue states rather than hides.
        Catalog.Find(EmailVerificationService.TemplateKey).Should().NotBeNull();
    }

    [Fact]
    public void Find_MatchesTheKeyCaseInsensitively()
    {
        Catalog.Find("VERIFY-EMAIL").Should().NotBeNull();
    }

    [Fact]
    public void Find_ReturnsNullForAKeyNothingDeclares()
    {
        Catalog.Find("no-such-template").Should().BeNull();
    }

    [Fact]
    public void EveryDeclaredToken_IsSpelledTheWayTheRendererWouldMatchIt()
    {
        // MailTemplateRenderer's regex is [A-Za-z0-9_]+. A catalogue entry outside that can
        // never be matched in a template, so the editor would offer a token that does nothing.
        var renderer = new MailTemplateRenderer();

        foreach (var definition in Catalog.All)
        {
            foreach (var token in definition.Tokens)
            {
                renderer.ExtractPlaceholders($"{{{{{token.Name}}}}}")
                    .Should().ContainSingle().Which.Should().Be(token.Name,
                        $"'{token.Name}' in '{definition.Key}' has to be a name the renderer can match");
            }
        }
    }

    [Fact]
    public void EveryDeclaredToken_CarriesSomethingWorthShowingAnOperator()
    {
        // The whole point of the catalogue over the free-text Description column it replaces.
        foreach (var definition in Catalog.All)
        {
            definition.Purpose.Should().NotBeNullOrWhiteSpace();

            foreach (var token in definition.Tokens)
            {
                token.Label.Should().NotBeNullOrWhiteSpace();
                token.Description.Should().NotBeNullOrWhiteSpace();
                token.SampleValue.Should().NotBeNullOrWhiteSpace(
                    "the preview substitutes this, and an empty sample previews as a gap");
            }
        }
    }
}
