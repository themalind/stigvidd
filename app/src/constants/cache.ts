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
export const TRAIL_COORDINATES_STALE_TIME = 24 * 60 * 60 * 1000; // trail geometry is immutable
export const TRAIL_LIST_STALE_TIME = 24 * 60 * 60 * 1000; // full trail list (also used as gcTime)

// --- Per-trail detail content ---
export const TRAIL_DETAIL_STALE_TIME = 5 * 60 * 1000; // trail info, obstacles, coordinates on the detail screen
export const REVIEWS_STALE_TIME = 5 * 60 * 1000; // reviews + derived rating

// --- User-scoped lists (refreshed via mutation invalidation) ---
// The current-user profile has no edit flow (users API is get/create/delete only)
// and its embedded favorites/wishlist are never read, so it's safe to cache. If a
// profile-edit feature is added, invalidate ["currentUser"] on success.
export const CURRENT_USER_STALE_TIME = 5 * 60 * 1000; // current user profile
export const USER_LIST_STALE_TIME = 5 * 60 * 1000; // favorites + wishlist
export const FRIENDS_STALE_TIME = 5 * 60 * 1000; // accepted friends list
export const HIKES_STALE_TIME = 5 * 60 * 1000; // the user's own hikes
export const SHARED_HIKES_STALE_TIME = 5 * 60 * 1000; // accepted shared hikes
