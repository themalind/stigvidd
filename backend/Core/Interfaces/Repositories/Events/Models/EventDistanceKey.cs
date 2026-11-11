// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events.Models;

// SquaredMetres as EventDistance measures it from the same origin. keep-comment: the cursor compares it exactly
public record EventDistanceKey(double SquaredMetres, int Id);
