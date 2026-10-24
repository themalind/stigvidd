// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Net;
using WebDataContracts.ResponseModels.Trail;

namespace StigviddLinks;

public enum TrailLookupStatus
{
    Found,
    NotFound,
    Unavailable,
}

public record TrailLookup(TrailLookupStatus Status, TrailResponse? Trail = null);

public class TrailClient(HttpClient http, ILogger<TrailClient> logger)
{
    public async Task<TrailLookup> GetTrailAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            using var response = await http.GetAsync($"api/v1/Trails/{Uri.EscapeDataString(identifier)}", ctoken);

            if (response.StatusCode == HttpStatusCode.NotFound)
                return new TrailLookup(TrailLookupStatus.NotFound);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("The API answered {StatusCode} for trail {Identifier}.", (int)response.StatusCode, identifier);
                return new TrailLookup(TrailLookupStatus.Unavailable);
            }

            var trail = await response.Content.ReadFromJsonAsync<TrailResponse>(ctoken);

            return trail is null
                ? new TrailLookup(TrailLookupStatus.NotFound)
                : new TrailLookup(TrailLookupStatus.Found, trail);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ctoken.IsCancellationRequested)
        {
            logger.LogWarning(ex, "The API could not be reached for trail {Identifier}.", identifier);
            return new TrailLookup(TrailLookupStatus.Unavailable);
        }
    }
}
