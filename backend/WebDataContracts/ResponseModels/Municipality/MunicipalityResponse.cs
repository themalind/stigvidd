// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Municipality;

public class MunicipalityResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required string Slug { get; set; }
}
