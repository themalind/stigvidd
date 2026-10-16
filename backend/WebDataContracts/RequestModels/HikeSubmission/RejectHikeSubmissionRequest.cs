// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.HikeSubmission;

public class RejectHikeSubmissionRequest
{
    public required string Reason { get; set; }
}
