// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Enums;

namespace Core.Repositories.Reporting;

public class ReportableContentHandlers
{
    private readonly Dictionary<ReportedContentType, IReportableContentHandler> _byType;

    public ReportableContentHandlers(IEnumerable<IReportableContentHandler> handlers)
    {
        _byType = handlers.ToDictionary(h => h.ContentType);
    }

    public IReportableContentHandler? For(ReportedContentType contentType)
    {
        return _byType.GetValueOrDefault(contentType);
    }
}
