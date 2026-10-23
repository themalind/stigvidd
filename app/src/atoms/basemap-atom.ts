// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import type { Basemap } from "@/components/map/map-style";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { atom } from "jotai";
import { logger } from "../services/logger";

const STORAGE_KEY = "my-basemap";

export const basemapAtom = atom<Basemap>("outdoor");

export const loadBasemap = async (): Promise<Basemap> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored === "satellite" ? "satellite" : "outdoor";
  } catch (e) {
    logger.warn("Could not read the stored basemap; falling back to outdoor", { error: String(e) });
    return "outdoor";
  }
};

export const saveBasemap = async (basemap: Basemap) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, basemap);
  } catch (e) {
    logger.warn("Could not persist the basemap choice", { error: String(e) });
  }
};
