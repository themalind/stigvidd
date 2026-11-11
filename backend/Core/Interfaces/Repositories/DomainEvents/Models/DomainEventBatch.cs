// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories.DomainEvents.Models;

// DueCount is what the query found, Claimed what this caller won; the two differ when another writer moved a row first. keep-comment: the drain loop keys on DueCount
public record DomainEventBatch(IReadOnlyList<DomainEventRecord> Claimed, int DueCount);
