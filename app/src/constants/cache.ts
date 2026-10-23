// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// TanStack Query `staleTime` values (in milliseconds).
//
// staleTime controls how long fetched data is considered fresh: while fresh, a
// remount serves from cache instead of refetching. The right value depends on
// how often the underlying data changes — not on a single global default, which
// is why these live per-query rather than on the QueryClient.
//
// Anything refreshed by mutation invalidation (favorites, friends, hikes, etc.)
// is safe to cache: the relevant mutation invalidates its key, so changes still
// appear immediately — the window below only affects passive navigation.

// --- Static / reference data — rarely or never changes ---
export const ISSUE_TYPES_STALE_TIME = 24 * 60 * 60 * 1000; // obstacle issue-type lookup (fixed enum)
export const REPORT_REASONS_STALE_TIME = 24 * 60 * 60 * 1000; // report-reason lookup (fixed enum)
export const TRAIL_COORDINATES_STALE_TIME = 24 * 60 * 60 * 1000; // trail geometry is immutable
export const CITY_AREAS_STALE_TIME = 24 * 60 * 60 * 1000; // city area list rarely changes
export const HIKE_GEOMETRY_STALE_TIME = 24 * 60 * 60 * 1000; // a recorded hike's route is immutable

// --- Per-trail detail content ---
export const TRAIL_DETAIL_STALE_TIME = 5 * 60 * 1000; // trail info, obstacles, coordinates on the detail screen
export const REVIEWS_STALE_TIME = 5 * 60 * 1000; // reviews + derived rating, and whether the user has reviewed
export const TRAIL_LIKES_STALE_TIME = 5 * 60 * 1000; // like count and the user's own like on a contributed trail
export const TRAIL_LIST_STALE_TIME = 60 * 60 * 1000; // full trail list; grows when a published walk is approved
export const TRAIL_LIST_GC_TIME = 24 * 60 * 60 * 1000; // kept for a day so the list still shows offline
export const TRAIL_MARKERS_STALE_TIME = 5 * 60 * 1000; // trail and facility markers on the map
export const POPULAR_TRAILS_STALE_TIME = 10 * 60 * 1000; // popular trails and popular contributions on the home screen
export const WEATHER_STALE_TIME = 30 * 60 * 1000; // SMHI forecast
export const REVERSE_GEOCODE_STALE_TIME = 10 * 60 * 1000; // place name for a position

// --- MapLibre ambient tile-cache (self-healing) ---
// maplibre-native keeps a local SQLite ambient cache for vector tiles/glyphs.
// It can intermittently fall into a corrupt state where every tile request is
// cancelled ("permanent error: Canceled") and the map stays blank. We cap its
// size and reset it on each new build to neutralise that trigger — see
// `app/src/utils/map-cache.ts`.
export const MAP_AMBIENT_CACHE_MAX_BYTES = 100 * 1024 * 1024; // 100 MB, shared by the outdoor and satellite basemaps
export const MAP_CACHE_BUILD_KEY = "@stigvidd/map_cache_build"; // AsyncStorage key: last build the cache was reset for

// --- User-scoped lists (refreshed via mutation invalidation) ---
// The current-user profile has no edit flow (users API is get/create/delete only)
// and its embedded favorites/wishlist are never read, so it's safe to cache. If a
// profile-edit feature is added, invalidate ["currentUser"] on success.
export const CURRENT_USER_STALE_TIME = 5 * 60 * 1000; // current user profile
export const USER_LIST_STALE_TIME = 5 * 60 * 1000; // favorites + wishlist
export const FRIENDS_STALE_TIME = 5 * 60 * 1000; // accepted friends list
export const HIKES_STALE_TIME = 5 * 60 * 1000; // the user's own hikes
export const SHARED_HIKES_STALE_TIME = 5 * 60 * 1000; // accepted shared hikes, and one incoming share's detail
export const BLOCKS_STALE_TIME = 5 * 60 * 1000; // blocked users
export const USER_SEARCH_STALE_TIME = 10 * 1000; // nickname search results
// keep-comment: short because Android push does not always arrive, so the tab badge relies on refetching
export const REQUESTS_STALE_TIME = 30 * 1000; // incoming and outgoing friend requests, incoming shared hikes
