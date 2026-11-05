// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Net;
using System.Net.Http.Json;

namespace LinkTests;

public class StubApiHandler : HttpMessageHandler
{
    private Func<HttpRequestMessage, HttpResponseMessage> _respond =
        _ => new HttpResponseMessage(HttpStatusCode.NotFound);

    public List<Uri> Requests { get; } = [];

    public void Returns(object body) =>
        _respond = _ => new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(body) };

    public void Returns(HttpStatusCode status) =>
        _respond = _ => new HttpResponseMessage(status);

    public void Throws(Exception exception) =>
        _respond = _ => throw exception;

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.RequestUri is { } uri)
            Requests.Add(uri);

        return Task.FromResult(_respond(request));
    }
}
