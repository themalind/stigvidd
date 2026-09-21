// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// keep-comment: what TrailImage and FacilityImage have in common, so the library filter is one expression applied to the entity. It cannot be applied to the projection instead: EF translates neither an OrderBy nor a method chain such as ImageUrl.ToLower().EndsWith(...) through a constructor projection, and fails only against a real database - EF InMemory runs it client side and stays green.
public interface IMediaImage
{
    string ImageUrl { get; }
    int Width { get; }
    int Height { get; }
    long SizeBytes { get; }
    DateTime CreatedAt { get; }
}
