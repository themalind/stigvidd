<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Removing an observed query does not stop its refetch

**Symptom:** after deleting an event from its own detail screen, the dev build showed two
`Console Error`s: `getEvent failed … 404` and `getEventParticipants failed … 404`. The DELETE
itself had succeeded.

**Cause:** the mutation's `onSuccess` invalidated all of `["events"]` before the screen
navigated away. The detail and participants queries still had mounted `useQuery` observers, so
they refetched the deleted event at once and `sendAuthed` logged the 404.

**Why `removeQueries` looks right but is not:** removing the queries from the cache stops that
one invalidation from finding them. But the mutation settling re-renders the screen, and the
mounted observer's `setOptions` calls `QueryCache.build`. That creates a fresh query with no
data, which is stale, so it fetches again and you get the same 404.

**What works:** invalidate everything except the deleted entity's own queries. Event query keys
all carry the identifier at index 2 (`detail`, `participants`, `board`):

```ts
void queryClient.invalidateQueries({
  queryKey: ["events"],
  predicate: (query) => query.queryKey[2] !== identifier,
});
```

Those queries are dropped by gcTime once the screen unmounts. Code:
[useEventManage.ts](../../app/src/hooks/events/useEventManage.ts) (`deleteMutation`). Test, which
fails with a blanket invalidation: [useEventManage.test.tsx](../../app/src/hooks/__tests__/useEventManage.test.tsx).
The same applies to any delete issued from the screen that shows the deleted thing.
