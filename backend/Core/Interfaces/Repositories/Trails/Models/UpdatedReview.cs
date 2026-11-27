// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories.Trails.Models;

public record UpdatedReview(Review Review, IReadOnlyCollection<string> RemovedImageUrls);
