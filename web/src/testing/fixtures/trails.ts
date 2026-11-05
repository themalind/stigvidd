// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminTrailListItemResponse, TrailResponse } from "@/api/generated/model";

export function trailListItem(overrides: Partial<AdminTrailListItemResponse> = {}): AdminTrailListItemResponse {
  return {
    identifier: "trail-1",
    name: "Knalleleden",
    trailLength: 42,
    accessibility: false,
    classification: 2,
    city: "Borås",
    isVerified: true,
    hasImages: true,
    hasExampleImages: false,
    hasSymbol: true,
    hasDescription: true,
    hasFullDescription: true,
    createdAt: "2026-01-01T00:00:00Z",
    lastUpdatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

export function trailDetail(overrides: Partial<TrailResponse> = {}): TrailResponse {
  return {
    identifier: "trail-1",
    name: "Knalleleden",
    trailLength: 42,
    classification: 2,
    accessibility: true,
    accessibilityInfo: "Gravel throughout",
    trailSymbol: "symbol.png",
    trailSymbolImage: "",
    description: "A long walk",
    fullDescription: "A very long walk",
    tags: '["forest"]',
    createdBy: "admin",
    isVerified: true,
    city: "Borås",
    visitorInformation: {
      identifier: "visitor-1",
      gettingThere: "Bus 100",
      publicTransport: "Yes",
      parking: "By the church",
      illumination: true,
      illuminationText: "First 3 km",
      maintainedBy: "Borås stad",
      winterMaintenance: false,
    },
    trailImagesResponse: [],
    trailLinksResponse: [{ identifier: "link-1", title: "Borås Stad", link: "https://www.boras.se" }],
    ...overrides,
  };
}
