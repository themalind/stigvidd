// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Media.Models;

// Cuts the oriented image to Aspect (width / height): a taller one at FocusY (0 top, 1 bottom) of its spare height, a wider one centred. keep-comment: the rectangle depends on the size after AutoOrient
public record AspectCrop(double Aspect, double FocusY);
