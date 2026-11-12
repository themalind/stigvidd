// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Facilities.Models;

// keep-comment: Notes says what the reader had to change to store a site, such as a link that is not a web address
public record FacilityFile(IReadOnlyCollection<SourceFacility> Sites, IReadOnlyCollection<string> Notes);
