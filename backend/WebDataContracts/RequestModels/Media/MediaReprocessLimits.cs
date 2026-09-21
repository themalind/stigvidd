// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Media;

// keep-comment: beside the request it bounds rather than in Core/Services, so the validator does not reach across a layer for a constant and a client can refuse an oversized selection before sending it
public static class MediaReprocessLimits
{
    public const int MaxExplicitBatchSize = 2000;

    // keep-comment: the dispatcher is single-reader and does one download/decode/encode/upload per item, so this cap is wall-clock, not storage - at roughly a second an image it is over an hour
    public const int MaxFilterBatchSize = 5000;
}
