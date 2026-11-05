// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Media;

public record UploadedMedia(string Path, int Width, int Height, long SizeBytes);
