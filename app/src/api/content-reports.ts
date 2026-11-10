// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ContentReport, CreateContentReportRequest } from "@/data/types";
import { sendForJson } from "./core/request";

export function getReportReasons(): Promise<string[]> {
  return sendForJson({
    name: "getReportReasons",
    path: "/contentreports/reasons",
    endpoint: "/contentreports/reasons",
  });
}

export function createContentReport(report: CreateContentReportRequest): Promise<ContentReport> {
  return sendForJson({
    name: "createContentReport",
    method: "POST",
    path: "/contentreports",
    endpoint: "/contentreports",
    body: report,
  });
}
