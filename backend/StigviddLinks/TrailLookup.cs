// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Trail;

namespace StigviddLinks;

public record TrailLookup(TrailLookupStatus Status, TrailResponse? Trail = null);
