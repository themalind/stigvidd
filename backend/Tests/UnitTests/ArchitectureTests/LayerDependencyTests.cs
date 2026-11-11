// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using ArchUnitNET.Fluent;
using ArchUnitNET.Loader;
using AwesomeAssertions;
using Infrastructure.Data;
using StigviddAPI.Controllers;
using WebDataContracts.Enums;
using static ArchUnitNET.Fluent.ArchRuleDefinition;

namespace UnitTests.ArchitectureTests;

// The layer rules in docs/conventions/backend.md. keep-comment: where each rule is explained
public class LayerDependencyTests
{
    private static readonly ArchUnitNET.Domain.Architecture Backend = new ArchLoader()
        .LoadAssemblies(
            typeof(Result).Assembly,
            typeof(StigViddDbContext).Assembly,
            typeof(AccountController).Assembly,
            typeof(MediaSort).Assembly)
        .Build();

    private const string DbContext = "Infrastructure.Data.StigViddDbContext";

    // keep-comment: the records in a Models folder are plain data, so any layer may hold them
    private const string Repositories = @"^(?!.*\.Models(\.|$))(Core\.Repositories|Core\.Interfaces\.Repositories)(\..+)?$";
    private const string Services = @"^(?!.*\.Models(\.|$))Core\.Interfaces\.Services(\..+)?$";

    [Fact]
    public void Controllers_ShouldNotReachRepositoriesOrTheDatabase()
    {
        var rule = Types().That().ResideInNamespaceOrBelow("StigviddAPI.Controllers")
            .Should().NotDependOnAny(Types().That()
                .ResideInNamespaceMatching(Repositories)
                .Or().ResideInNamespaceOrBelow("Infrastructure.Data"));

        Violations(rule).Should().BeEmpty();
    }

    [Fact]
    public void Repositories_ShouldNotCallServices()
    {
        var rule = Types().That().ResideInNamespaceOrBelow("Core.Repositories")
            .Should().NotDependOnAny(Types().That().ResideInNamespaceMatching(Services));

        Violations(rule).Should().BeEmpty();
    }

    [Fact]
    public void Factories_ShouldOnlyMap()
    {
        // keep-comment: the renderer only parses placeholders out of text, it reads nothing
        var rule = Types().That().ResideInNamespaceOrBelow("Core.Factories")
            .Should().NotDependOnAny(Types().That()
                .ResideInNamespaceMatching(Repositories)
                .Or().ResideInNamespaceMatching(Services)
                .Or().HaveFullName(DbContext)
                .And().DoNotHaveFullName("Core.Interfaces.Services.Mail.IMailTemplateRenderer"));

        Violations(rule).Should().BeEmpty();
    }

    [Fact]
    public void Validators_ShouldOnlyCheckTheRequest()
    {
        var rule = Types().That().ResideInNamespaceOrBelow("Core.Validators")
            .Should().NotDependOnAny(Types().That()
                .ResideInNamespaceMatching(Repositories)
                .Or().ResideInNamespaceMatching(Services)
                .Or().HaveFullName(DbContext));

        Violations(rule).Should().BeEmpty();
    }

    [Fact]
    public void Services_ShouldReachTheDatabaseThroughRepositories()
    {
        // keep-comment: DataTransfer moves whole tables between environments, which no repository models
        var rule = Types().That().ResideInNamespaceOrBelow("Core.Services")
            .And().DoNotResideInNamespaceOrBelow("Core.Services.DataTransfer")
            .Should().NotDependOnAny(Types().That().HaveFullName(DbContext));

        Violations(rule).Should().BeEmpty();
    }

    private static List<string> Violations(IArchRule rule)
    {
        return rule.Evaluate(Backend).Where(result => !result.Passed).Select(result => result.Description).ToList();
    }
}
