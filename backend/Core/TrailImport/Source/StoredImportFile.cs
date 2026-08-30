// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.TrailImport.Source;

// An uploaded source file after it has been written to disk. The hash is taken while
// writing, so the file is only read once.
public sealed record StoredImportFile(string StoredPath, string FileHash, long SizeBytes);
