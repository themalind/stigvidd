<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# A ban is read-only and global; a block is one-way and silent. Two features, one word

Two different things that are easy to call "blocking". Conflating them bars sign-in where the
intent is to silence, so the words are kept apart:

| | who does it | what it does |
| --- | --- | --- |
| **ban** | a moderator, from the admin dashboard | the account reads the app exactly as before and cannot write to it |
| **block** | any user, from their friends list | that person disappears for the blocker only; they are never told |

## Ban

An unlifted `UserBan` row (`LiftedAt` null) **is** the gate. `AdminUserService` writes it and does
nothing else — in particular it does **not** touch Keycloak. Disabling the Keycloak user bars
sign-in, which is the one thing a ban must not do, and it is also indistinguishable from an
unverified account: Keycloak answers the same `invalid_grant`/"Account disabled" for both, so
the app would send a banned user to the verify-email screen, where no mail can ever arrive
because `EmailVerificationService` skips an address that is already verified.

Enforcement is one global action filter, `StigviddAPI/Authorization/BannedUserWriteFilter.cs`:
every non-GET by an account with an unlifted ban is refused with 403 unless the endpoint carries
`[AllowWhenBanned]`. **The default is refusal**, so a write endpoint added later is closed to
banned users until someone decides otherwise — the opposite of a deny-list, which fails open.
`Tests/IntegrationTests/Authorization/BannedUserWriteTests.cs` pins the complete list of marked
writes, because the risk is a mark on something that does reach other people.

What stays open: recording and deleting their own hikes, favourites and wishlist, push tokens,
deleting their own content and their own account, blocking someone, leaving a friendship,
answering a share, and reporting content. **Editing a hike is refused**: a hike they shared
before the ban shows its name and description to every recipient, so an edit reaches other
people. Also `POST /Trails/cards`, which is a batched read that happens to be a POST
— refusing it would empty the trail list, which is the opposite of what a ban is.

`UserResponse.BannedAt` rides along on the user lookup every authenticated route already does,
so the app can say *why* a button is unavailable (`useCanWrite`) rather than letting the request
fail with a generic error. The server is still the gate; the app is only being polite.

`UserBans` keeps every ban: `UnbanAsync` stamps `LiftedAt`/`LiftedBy` on the active row
instead of deleting it, and the next ban is a new row. The wire keeps a single `BannedAt`,
derived from the active row. A partial unique index (`WHERE "LiftedAt" IS NULL`) allows one
active ban per user, and banning an already-banned account is a 409, so a second moderator's
stale Ban button cannot overwrite the first ban's date, author and reason.

## Block

`UserBlock` (`BlockerUserId`, `BlockedUserId`) is **one-way and silent**. `GetHiddenUserIdsAsync`
returns only the people this user blocked; being blocked hides nothing from the blocked side,
so their view of the app does not change in any way. That asymmetry is deliberate and is the
first thing a reader will try to "fix".

Silence is not decoration — it is forced. A one-way block with a *visible* refusal tells the
blocked person exactly what happened, because they know they did not block anyone. So nothing
is ever refused and **nothing is deleted**: `BlockUserAsync` writes the row and stops. The
friendship and the shared walks stay exactly where they were, because removing them is the one
thing the blocked person could notice.

Everything therefore happens on the **blocker's** reads, seven of them:

| what | where |
| --- | --- |
| leaves a blocked author out of a trail's reviews | `Core/Repositories/ReviewRepository.cs` |
| leaves a blocked reporter out of a trail's obstacles | `Core/Repositories/TrailObstacleRepository.cs` |
| leaves a blocked voter's solved vote out of an obstacle | `Core/Factories/TrailObstaclesResponseFactory.cs` — not the repository, see below |
| leaves a blocked person out of friend search | `Core/Repositories/UserRepository.cs` |
| leaves them out of the friends list | `Core/Repositories/FriendRepository.cs` |
| leaves their friend request out of the incoming and outgoing lists | same |
| leaves a walk they shared out of the shared lists | `Core/Repositories/HikeShareRecipientRepository.cs` |

That last one checks the **sharer** only, not the hike's owner (`NotFromHiddenUser`): a walk a
mutual friend reshares arrives in that friend's name, so it is theirs to send, and the push for
it (named after the resharer) agrees with the list. No seeded share has sharer != owner, so its
test builds its own row.

The eighth place is **notifications**, and it is a chokepoint rather than a filter:
`IPushNotificationService.SendToUserAsync` takes an optional `fromUserIdentifier`, and
`ExpoPushService` drops the push when the recipient has blocked that sender. Every notification
a *person* triggers passes it — friend request, request accepted, share, reshare. Omitting it on
a new notification silently defeats the block, which is why the check lives in one place instead
of at each call site. It fails **open**: a lookup that errors sends, because losing a
notification is worse than one arriving from someone blocked.

So a blocked person's friend request is written as normal, sits in their outgoing list as
pending for ever, and simply never appears in the recipient's incoming list. It is
indistinguishable from not being answered.

`IUserBlockService.GetHiddenUserIdsForReadAsync` is the one place that turns a viewer into that
list. It returns **empty** for a signed-out reader and empty when the lookup fails: a database
blip must not blank a trail page.

The filter is an explicit predicate and **not** a global query filter. It cannot be one:
`StigViddDbContext` is built from `IDbContextFactory`, which is not request-scoped, so the
context has no way to know who is asking.

Two things that look like bugs and are not:

- **The rating average does not move.** `TrailRepository` computes `t.Reviews.Average(...)`
  inside the trail listings. Filtering that per viewer would touch every trail query in the app,
  and the same trail would then show two different numbers to two people. The rule is: the
  rating is the trail's, the list is yours.
- **A blocked person's solved vote still counts.** It is left out of what you see, but the three
  votes that close a report are counted in `ActiveObstacles` over the unfiltered set, so the
  threshold is the same for everyone. The repository therefore loads every vote and the factory
  drops the hidden voters from `SolvedVotes` while `SolvedVoteCount` keeps them: the app draws
  "n/3" from the count. Filtering in the `Include` instead would read "1/3" on an obstacle one
  vote from closing, and it would vanish at "2/3".

## The part that is easy to get wrong

`GET reviews/trail/{id}` and `GET trailobstacles/trail/{id}` are `[AllowAnonymous]`. That
attribute skips **authorization**, not authentication, so a signed-in reader is still identified
and gets their blocks applied; a signed-out one resolves to `null` and sees everything.

But the app has to send the token for that to happen. Without the header the server filters
nothing and the feature looks broken with nothing failing anywhere.
`app/src/api/__tests__/endpoint-contract.test.ts` has a third auth kind, `"optional"`, that
pins exactly this.
