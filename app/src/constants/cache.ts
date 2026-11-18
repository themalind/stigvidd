// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// keep-comment: per query, since the right staleTime depends on how often the data changes
// keep-comment: data a mutation invalidates is safe to cache; the window only affects passive navigation

export const ISSUE_TYPES_STALE_TIME = 24 * 60 * 60 * 1000; // obstacle issue-type lookup (fixed enum)
export const REPORT_REASONS_STALE_TIME = 24 * 60 * 60 * 1000; // report-reason lookup (fixed enum)
export const TRAIL_COORDINATES_STALE_TIME = 24 * 60 * 60 * 1000; // trail geometry is immutable
export const CITY_AREAS_STALE_TIME = 24 * 60 * 60 * 1000; // city area list rarely changes
export const HIKE_GEOMETRY_STALE_TIME = 24 * 60 * 60 * 1000; // a recorded hike's route is immutable

export const TRAIL_DETAIL_STALE_TIME = 5 * 60 * 1000; // trail info, obstacles, coordinates on the detail screen
export const REVIEWS_STALE_TIME = 5 * 60 * 1000; // reviews + derived rating, and whether the user has reviewed
export const TRAIL_LIKES_STALE_TIME = 5 * 60 * 1000; // like count and the user's own like on a contributed trail
export const TRAIL_LIST_STALE_TIME = 60 * 60 * 1000; // full trail list; grows when a published walk is approved
export const TRAIL_LIST_GC_TIME = 24 * 60 * 60 * 1000; // kept for a day so the list still shows offline
export const TRAIL_MARKERS_STALE_TIME = 5 * 60 * 1000; // trail and facility markers on the map
export const POPULAR_TRAILS_STALE_TIME = 10 * 60 * 1000; // popular trails and popular contributions on the home screen
export const WEATHER_STALE_TIME = 30 * 60 * 1000; // SMHI forecast
export const REVERSE_GEOCODE_STALE_TIME = 10 * 60 * 1000; // place name for a position

// keep-comment: capped and reset per build against the corrupt-cache blank map (utils/map/map-cache.ts)
export const MAP_AMBIENT_CACHE_MAX_BYTES = 100 * 1024 * 1024; // 100 MB, shared by the outdoor and satellite basemaps
export const MAP_CACHE_BUILD_KEY = "@stigvidd/map_cache_build"; // AsyncStorage key: last build the cache was reset for

// keep-comment: a future profile edit must invalidate ["currentUser"]
export const CURRENT_USER_STALE_TIME = 5 * 60 * 1000; // current user profile
export const USER_LIST_STALE_TIME = 5 * 60 * 1000; // favorites + wishlist
export const FRIENDS_STALE_TIME = 5 * 60 * 1000; // accepted friends list
export const HIKES_STALE_TIME = 5 * 60 * 1000; // the user's own hikes
export const SHARED_HIKES_STALE_TIME = 5 * 60 * 1000; // accepted shared hikes, and one incoming share's detail
export const BLOCKS_STALE_TIME = 5 * 60 * 1000; // blocked users
export const USER_SEARCH_STALE_TIME = 10 * 1000; // nickname search results
// keep-comment: short because Android push does not always arrive, so the tab badge relies on refetching
export const REQUESTS_STALE_TIME = 30 * 1000; // incoming and outgoing friend requests, incoming shared hikes, event invitations
export const EVENTS_STALE_TIME = 60 * 1000; // event lists, one event's detail and participants
export const EVENT_BOARD_STALE_TIME = 15 * 1000; // an event's board
