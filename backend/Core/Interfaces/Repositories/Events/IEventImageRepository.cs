// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events;

public interface IEventImageRepository
{
    // NotFound when the event is gone. keep-comment: the caller then deletes the file it just uploaded
    Task<RepositoryResult<ReplacedEventImage>> ReplaceAsync(int eventId, string imageUrl, CancellationToken ctoken);
    // The file to delete, or null. keep-comment: Success also when there was no image
    Task<RepositoryResult<string?>> DeleteAsync(int eventId, CancellationToken ctoken);
}
