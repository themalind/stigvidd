// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { paths } from "@/config/paths";
import type { ApplyResult } from "@/features/facility-import/api/facility-import";

interface Props {
  result: ApplyResult;
  sourceKey: string;
  sourceName: string;
  onAnother: () => void;
}

export function ImportDone({ result, sourceKey, sourceName, onAnother }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Imported</h2>
      <p className="text-sm">
        {result.created} new, {result.linked} linked to facilities we had and {result.updated} updated, from{" "}
        {sourceName}. {result.unchanged} were already up to date.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link to={paths.facilities({ source: sourceKey })}>Open them in Facilities</Link>
        </Button>
        <Button variant="ghost" onClick={onAnother}>
          Import another file
        </Button>
      </div>
    </section>
  );
}
