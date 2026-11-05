// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.Admin;

public record AdminDashboardCounts(int UserCount, int NewUsers, int ReviewCount, int NewReviews);
