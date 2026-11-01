// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories.Events;

public class EventImageRepository : IEventImageRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<EventImageRepository> _logger;

    public EventImageRepository(IDbContextFactory<StigViddDbContext> context, ILogger<EventImageRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    // A new row rather than a new path, so a pending report on the old image is not carried over to this one. keep-comment: the report names the row
    public async Task<RepositoryResult<ReplacedEventImage>> ReplaceAsync(int eventId, string imageUrl, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            // Serialises two uploads to the same event, which would otherwise both pass the one-image-per-event check. keep-comment: the unique index on EventId
            await EventCounts.LockAsync(context, eventId, ctoken);

            if (!await context.Events.AnyAsync(e => e.Id == eventId, ctoken))
                return RepositoryResult<ReplacedEventImage>.NotFound();

            var removed = await RemoveExistingAsync(context, eventId, ctoken);

            var image = new EventImage { EventId = eventId, ImageUrl = imageUrl };
            context.EventImages.Add(image);
            await context.SaveChangesAsync(ctoken);

            await transaction.CommitAsync(ctoken);

            return RepositoryResult<ReplacedEventImage>.Success(new ReplacedEventImage(image.Identifier, removed));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventImageRepository: ReplaceAsync -> Something went wrong when replacing the image of event {EventId}.", eventId);
            return RepositoryResult<ReplacedEventImage>.Error();
        }
    }

    public async Task<RepositoryResult<string?>> DeleteAsync(int eventId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);
            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            await EventCounts.LockAsync(context, eventId, ctoken);

            var removed = await RemoveExistingAsync(context, eventId, ctoken);

            await transaction.CommitAsync(ctoken);

            return RepositoryResult<string?>.Success(removed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "EventImageRepository: DeleteAsync -> Something went wrong when deleting the image of event {EventId}.", eventId);
            return RepositoryResult<string?>.Error();
        }
    }

    // Saved before it returns, so the reference check no longer sees this row. keep-comment: and the unique index on EventId frees up for an insert
    private static async Task<string?> RemoveExistingAsync(StigViddDbContext context, int eventId, CancellationToken ctoken)
    {
        var existing = await context.EventImages.FirstOrDefaultAsync(i => i.EventId == eventId, ctoken);

        if (existing is null)
            return null;

        context.EventImages.Remove(existing);
        await context.SaveChangesAsync(ctoken);

        return await ImageReferences.IsReferencedAsync(context, existing.ImageUrl, ctoken) ? null : existing.ImageUrl;
    }
}
