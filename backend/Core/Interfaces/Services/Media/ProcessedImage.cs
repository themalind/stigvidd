// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Media;

public sealed class ProcessedImage : IDisposable
{
    public required Stream Stream { get; init; }
    public required string Extension { get; init; }
    public required string ContentType { get; init; }
    public int Width { get; init; }
    public int Height { get; init; }
    public long SizeBytes { get; init; }

    public void Dispose() => Stream.Dispose();
}
