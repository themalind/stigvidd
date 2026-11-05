// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.TrailImport.Matching;

// keep-comment: Fingerprint is precomputed by the caller, which loads every trail once per import
public sealed record TrailCandidate(int TrailId, string Fingerprint, LineString Geometry);
