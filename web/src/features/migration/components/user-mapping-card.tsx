// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getErrorMessage } from "react-error-boundary";
import { Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  keycloakUsersQueryOptions,
  useDeleteUserMapping,
  userMappingsQueryOptions,
  useSaveUserMapping,
} from "@/features/migration/api/user-mappings";
import type { KeycloakUserResponse } from "@/api/generated/model";

const MIN_SEARCH = 3;

export default function UserMappingCard() {
  const { data } = useSuspenseQuery(userMappingsQueryOptions());
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [keycloakUser, setKeycloakUser] = useState<KeycloakUserResponse | null>(null);
  const [nickName, setNickName] = useState("");
  const [email, setEmail] = useState("");

  const found = useQuery({ ...keycloakUsersQueryOptions(submitted ?? ""), enabled: submitted !== null });
  const save = useSaveUserMapping();
  const remove = useDeleteUserMapping();

  const needle = filter.trim().toLowerCase();
  const users = data.users.filter(
    (u) => needle === "" || u.nickName.toLowerCase().includes(needle) || String(u.id).includes(needle),
  );

  function handleSearch() {
    const term = search.trim();
    if (term === submitted) {
      void found.refetch();
    } else {
      setSubmitted(term);
    }
  }

  function pickKeycloakUser(user: KeycloakUserResponse) {
    setKeycloakUser(user);
    setEmail(user.email ?? user.username);
    setNickName((current) => current || user.username.split("@")[0].slice(0, 20));
  }

  const canSave =
    selectedId !== null && keycloakUser !== null && nickName.trim() !== "" && email.trim() !== "" && !save.isPending;

  function handleSave() {
    if (selectedId === null || keycloakUser === null) return;
    save.mutate(
      {
        packageUserId: selectedId,
        request: { keycloakSubjectId: keycloakUser.id, nickName: nickName.trim(), email: email.trim() },
      },
      {
        onSuccess: () => {
          setSelectedId(null);
          setKeycloakUser(null);
          setNickName("");
          setEmail("");
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User mapping</CardTitle>
        <CardDescription>
          Link a user in the imported data to an existing Keycloak user, so they keep their username, password, nickname
          and email. Mappings are stored here and applied again on every import.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="user-filter">1. Pick the imported user</Label>
          <Input
            id="user-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by nickname or id"
            autoComplete="off"
          />
          <ul className="max-h-48 divide-y overflow-y-auto rounded-md border" aria-label="Imported users">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === u.id}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted aria-pressed:bg-muted"
                  onClick={() => setSelectedId(u.id)}
                >
                  <span>
                    {u.nickName} <span className="text-muted-foreground">#{u.id}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {u.hikeCount} hikes{u.isMapped ? " · mapped" : ""}
                  </span>
                </button>
              </li>
            ))}
            {users.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No users.</li>}
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="keycloak-search">2. Find the Keycloak user</Label>
          <div className="flex gap-2">
            <Input
              id="keycloak-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Username or email, at least ${MIN_SEARCH} characters`}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleSearch}
              disabled={search.trim().length < MIN_SEARCH || found.isFetching}
            >
              {found.isFetching ? <Loader2 className="animate-spin" /> : <Search />}
              Search
            </Button>
          </div>
          <ul className="divide-y rounded-md border empty:hidden" aria-label="Keycloak users">
            {found.data?.map((k) => (
              <li key={k.id}>
                <button
                  type="button"
                  aria-pressed={keycloakUser?.id === k.id}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted aria-pressed:bg-muted"
                  onClick={() => pickKeycloakUser(k)}
                >
                  {k.username}
                  {k.email && k.email !== k.username ? ` · ${k.email}` : ""}
                  {k.enabled ? "" : " (disabled)"}
                </button>
              </li>
            ))}
          </ul>
          {found.isError && (
            <p role="alert" className="text-sm text-destructive">
              {getErrorMessage(found.error) ?? "Search failed."}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mapped-nickname">3. Nickname to keep</Label>
            <Input
              id="mapped-nickname"
              value={nickName}
              maxLength={20}
              onChange={(e) => setNickName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mapped-email">Email to keep</Label>
            <Input id="mapped-email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
        </div>

        {data.mappings.length > 0 && (
          <div className="space-y-2">
            <Label>Saved mappings</Label>
            <ul className="divide-y rounded-md border" aria-label="Saved mappings">
              {data.mappings.map((m) => (
                <li key={m.packageUserId} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    #{m.packageUserId} → {m.keycloakUsername}{" "}
                    <span className="text-muted-foreground">({m.nickName})</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove mapping for user ${m.packageUserId}`}
                    onClick={() => remove.mutate(m.packageUserId)}
                    disabled={remove.isPending}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={!canSave}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Save mapping
        </Button>
      </CardFooter>
    </Card>
  );
}
