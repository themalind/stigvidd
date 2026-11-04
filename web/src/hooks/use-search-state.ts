// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { startTransition } from "react";
import { useSearchParams } from "react-router";

type Change = string | number | boolean | undefined;

// keep-comment: a value equal to its default stays out of the address, so a default can still be overridden by writing it explicitly ("All" while the default is "Pending")
export function useSearchState<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams();
  const keys = Object.keys(defaults) as K[];

  const values = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? defaults[key]])) as Record<K, string>;
  const page = Math.max(1, Number(params.get("page")) || 1);

  // keep-comment: any change but a page change drops the page, or page 4 of a narrower result would be empty
  function write(changes: Record<string, Change>) {
    startTransition(() =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (!("page" in changes)) next.delete("page");

        for (const [key, value] of Object.entries<Change>(changes)) {
          const text = value === undefined || value === false ? "" : String(value);
          const fallback = key === "page" ? "1" : (defaults[key as K] ?? "");
          if (text === "" || text === fallback) next.delete(key);
          else next.set(key, text);
        }
        return next;
      }),
    );
  }

  const update = (changes: Partial<Record<K, Change>> & { page?: number }) => write(changes);
  const setPage = (next: number) => write({ page: next });

  return { values, page, update, setPage };
}
