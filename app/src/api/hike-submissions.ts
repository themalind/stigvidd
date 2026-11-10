// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CreateHikeSubmissionRequest, HikeSubmission } from "@/data/types";
import { UPLOAD_TIMEOUT_MS } from "./core/api-config";
import { send, sendForJson } from "./core/request";

export function createHikeSubmission(request: CreateHikeSubmissionRequest): Promise<HikeSubmission> {
  return sendForJson({
    name: "createHikeSubmission",
    method: "POST",
    path: "/hikesubmissions",
    endpoint: "/hikesubmissions",
    body: request,
    // keep-comment: the server copies every chosen photo before it answers
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

export function getMyHikeSubmissions(): Promise<HikeSubmission[]> {
  return sendForJson({ name: "getMyHikeSubmissions", path: "/hikesubmissions", endpoint: "/hikesubmissions" });
}

export async function withdrawHikeSubmission(identifier: string): Promise<void> {
  await send({
    name: "withdrawHikeSubmission",
    method: "DELETE",
    path: `/hikesubmissions/${identifier}`,
    endpoint: "/hikesubmissions/{param}",
  });
}
