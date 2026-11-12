// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.DataTransfer.Models;

public record ImportPlan(bool RestoreKeycloak, bool NeutralizeOutbound, IReadOnlyList<string> Notes);
