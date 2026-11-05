// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Mail;

// The tokens each template key may use. This exists because the set was previously implicit:
// it lived only in the model dictionary built at the call site, and as a free-text sentence
// in MailTemplate.Description that nothing validated. An operator editing a template could
// not discover it, and a typo in it stops the mail entirely -- MailTemplateRenderer fails the
// whole render when a placeholder has no model value, and MailOutboxService.EnqueueAsync
// fails with it.
//
// Anything declared here is a promise that the call site really passes that key. The promise
// is kept by MailTemplateCatalogTests, which drives the real caller and compares.
public interface IMailTemplateCatalog
{
    IReadOnlyList<MailTemplateDefinition> All { get; }

    // Null for a key the catalogue does not describe: a row can exist in the database that
    // no C# caller sends, and the editor has to say so rather than pretend it knows.
    MailTemplateDefinition? Find(string key);
}
