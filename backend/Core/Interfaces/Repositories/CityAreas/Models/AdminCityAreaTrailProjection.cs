// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.CityAreas.Models;

public record AdminCityAreaTrailProjection(string Identifier, string Name, bool IsVerified, bool IsManual);
