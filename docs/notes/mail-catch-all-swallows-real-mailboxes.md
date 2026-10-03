# The @stigvidd.se catch-all also takes real mailboxes' mail unless each has an alias to itself

Mail to any @stigvidd.se address without a mailbox goes to `info@stigvidd.se`. This is the
alias `@stigvidd.se info@stigvidd.se`, added with `setup alias add` in
[DEPLOYMENT.md](../../DEPLOYMENT.md) Part 1 step 6. It lives in `mail-config/postfix-virtual.cf`
on the host, which is git-ignored.

It is easy to assume a catch-all is only a fallback for addresses that don't exist. In Postfix
it is not. `postfix-virtual.cf` becomes `virtual_alias_maps`, and Postfix rewrites recipients
through that map **before** it looks for a mailbox. A mailbox address with no exact line in the
map falls through to `@stigvidd.se` and is rewritten to info@. Its own mailbox then receives
nothing, nothing bounces, and nothing in the logs looks wrong apart from the `to=`/`orig_to=` pair.
The docker-mailserver FAQ ("How can I configure a catch-all?") gives the same warning.

So **every mailbox other than info@ needs an exact alias to itself**:

```bash
docker compose exec mailserver setup alias add no-reply@stigvidd.se no-reply@stigvidd.se
```

This applies to any mailbox created later as well. `setup email add` on its own is not enough
while the catch-all exists. An exact line always wins over `@domain`, whatever order the lines
are in. Add the self-alias before the catch-all (or straight after a new mailbox), so there is
no window where its mail is redirected.

To check one address, send to it from outside, then run
`docker compose exec mailserver setup debug show-mail-logs`. A redirected message shows
`to=<info@stigvidd.se>, orig_to=<the address>`. A correctly delivered one shows its own address
in `to=`.

The aliases matter for sending too. `SPOOF_PROTECTION=1` lets an account send as its own
aliases, so with the catch-all, info@ can probably send as any @stigvidd.se address that has no
exact line. A mailbox's self-alias keeps it the only one allowed to send as that address.
