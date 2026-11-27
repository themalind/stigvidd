// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CreateReviewRequest, PagedReviewResponse, Review, UpdateReviewRequest } from "@/data/types";
import { imageFormPart } from "./core/image-form-part";
import { queryString, send, sendForJson } from "./core/request";

export function getReviewsByTrailIdentifier(
  trailIdentifier: string,
  page: number,
  limit: number,
): Promise<PagedReviewResponse> {
  return sendForJson({
    name: "getReviewsByTrailIdentifier",
    path: `/reviews/trail/${trailIdentifier}${queryString({ page, limit })}`,
    endpoint: "/reviews/trail/{param}",
    auth: "optional",
  });
}

export function hasReviewedTrail(trailIdentifier: string): Promise<boolean> {
  return sendForJson({
    name: "hasReviewedTrail",
    path: `/reviews/trail/${trailIdentifier}/mine`,
    endpoint: "/reviews/trail/{param}/mine",
  });
}

export function getOwnReview(trailIdentifier: string): Promise<Review> {
  return sendForJson({
    name: "getOwnReview",
    path: `/reviews/trail/${trailIdentifier}/mine/review`,
    endpoint: "/reviews/trail/{param}/mine/review",
    quietStatuses: [404],
  });
}

export async function createReview(request: CreateReviewRequest): Promise<void> {
  const form = new FormData();

  request.imageUris.forEach((uri) => {
    form.append("images", imageFormPart(uri));
  });

  form.append("trailIdentifier", request.trailIdentifier);
  form.append("trailReview", request.review);
  form.append("rating", `${request.rating}`);

  await send({ name: "createReview", method: "POST", path: "/reviews/create", endpoint: "/reviews/create", form });
}

export function updateReview(request: UpdateReviewRequest): Promise<Review> {
  const form = new FormData();

  request.newImageUris.forEach((uri) => {
    form.append("images", imageFormPart(uri));
  });

  request.removedImageIdentifiers.forEach((identifier) => {
    form.append("removedImageIdentifiers", identifier);
  });

  form.append("trailReview", request.review);
  form.append("rating", `${request.rating}`);

  return sendForJson({
    name: "updateReview",
    method: "PUT",
    path: `/reviews/${request.reviewIdentifier}`,
    endpoint: "/reviews/{param}",
    form,
  });
}

export async function deleteReview(reviewIdentifier: string): Promise<void> {
  await send({
    name: "deleteReview",
    method: "DELETE",
    path: `/reviews/${reviewIdentifier}`,
    endpoint: "/reviews/{param}",
  });
}
