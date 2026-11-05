// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Net;
using WebDataContracts.ResponseModels.Event;
using WebDataContracts.ResponseModels.Trail;

namespace StigviddLinks;

public class ApiClient(HttpClient http, ILogger<ApiClient> logger)
{
    public Task<Lookup<TrailResponse>> GetTrailAsync(string identifier, CancellationToken ctoken)
    {
        return GetAsync<TrailResponse>($"api/v1/Trails/{Uri.EscapeDataString(identifier)}", "trail", identifier, ctoken);
    }

    public Task<Lookup<EventPreviewResponse>> GetEventAsync(string identifier, CancellationToken ctoken)
    {
        return GetAsync<EventPreviewResponse>($"api/v1/Events/{Uri.EscapeDataString(identifier)}/preview", "event", identifier, ctoken);
    }

    private async Task<Lookup<T>> GetAsync<T>(string path, string kind, string identifier, CancellationToken ctoken) where T : class
    {
        try
        {
            using var response = await http.GetAsync(path, ctoken);

            if (response.StatusCode == HttpStatusCode.NotFound)
                return new Lookup<T>(LookupStatus.NotFound);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("The API answered {StatusCode} for {Kind} {Identifier}.", (int)response.StatusCode, kind, identifier);
                return new Lookup<T>(LookupStatus.Unavailable);
            }

            var value = await response.Content.ReadFromJsonAsync<T>(ctoken);

            return value is null
                ? new Lookup<T>(LookupStatus.NotFound)
                : new Lookup<T>(LookupStatus.Found, value);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ctoken.IsCancellationRequested)
        {
            logger.LogWarning(ex, "The API could not be reached for {Kind} {Identifier}.", kind, identifier);
            return new Lookup<T>(LookupStatus.Unavailable);
        }
    }
}
