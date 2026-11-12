// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// keep-comment: one dataset a municipality publishes, such as Borås' bathing sites; its facilities share the Key as SourceId prefix
public class FacilityImportSource : BaseEntity
{
    public int MunicipalityId { get; set; }
    public Municipality? Municipality { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
    // keep-comment: "<municipality slug>:<slug>", e.g. "boras:badplatser"; it prefixes SourceId, so it never changes
    public required string Key { get; set; }
    // keep-comment: JSON of the last applied field mapping, so the next file of the same dataset needs no setup
    public string? Mapping { get; set; }
}
