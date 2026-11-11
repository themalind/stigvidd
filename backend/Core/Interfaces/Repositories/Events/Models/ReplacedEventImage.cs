// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events.Models;

// RemovedImageUrl is null when there was no image or another row still uses its file. keep-comment: non-null means the caller deletes the file
public record ReplacedEventImage(string Identifier, string? RemovedImageUrl);
