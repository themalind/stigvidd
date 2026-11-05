// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import type { AdminHikeSubmissionResponse } from "@/api/generated/model";
import { Page } from "@/components/page";
import { QueryBoundary } from "@/components/query-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { paths } from "@/config/paths";
import {
  submissionQueryOptions,
  useSaveSubmissionDetails,
  useSaveSubmissionRoute,
} from "@/features/hike-submissions/api/hike-submissions";
import { DecidedCard, DecisionCard } from "@/features/hike-submissions/components/decision-card";
import { JumpsCard } from "@/features/hike-submissions/components/jumps-card";
import { RouteModePanel } from "@/features/hike-submissions/components/route-mode-panel";
import { RouteToolbar } from "@/features/hike-submissions/components/route-toolbar";
import { SimilarRoutesCard } from "@/features/hike-submissions/components/similar-routes-card";
import {
  fieldsOf,
  sameFields,
  SubmissionDetailsCard,
  toUpdateRequest,
} from "@/features/hike-submissions/components/submission-details-card";
import { SubmissionMap } from "@/features/hike-submissions/components/submission-map";
import { SubmissionPhotosCard } from "@/features/hike-submissions/components/submission-photos-card";
import { TrimCard } from "@/features/hike-submissions/components/trim-card";
import { useRouteEditor } from "@/features/hike-submissions/hooks/use-route-editor";
import { useInvalidateTrailQueries } from "@/features/trails/api/trail";
import TrailImagesDialog from "@/features/trails/components/trail-images-dialog";
import { type LngLat, parseCoordinates, serializeCoordinates } from "@/utils/geometry-edit";

const LIST = paths.hikeSubmissions;

function BackLink() {
  return (
    <Link to={LIST} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" />
      Back to submissions
    </Link>
  );
}

export default function HikeSubmissionReviewPage() {
  const { identifier = "" } = useParams();

  return (
    <Page width="full" className="space-y-5 py-8">
      <QueryBoundary
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-[620px] w-full" />
          </div>
        }
        errorFallback={({ retry }) => (
          <div className="space-y-4">
            <BackLink />
            <p>Could not load this submission.</p>
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          </div>
        )}
      >
        <Review key={identifier} identifier={identifier} />
      </QueryBoundary>
    </Page>
  );
}

function Review({ identifier }: { identifier: string }) {
  const { data: detail } = useSuspenseQuery(submissionQueryOptions(identifier));
  const navigate = useNavigate();
  const invalidateTrails = useInvalidateTrailQueries();
  const savedPath = useMemo(() => parseCoordinates(detail.coordinates), [detail.coordinates]);
  const editor = useRouteEditor(savedPath);
  const [fields, setFields] = useState(() => fieldsOf(detail));
  const [satellite, setSatellite] = useState(false);
  const [focus, setFocus] = useState<LngLat[] | null>(null);
  const saveRoute = useSaveSubmissionRoute(identifier);
  const saveDetails = useSaveSubmissionDetails(identifier);

  const pending = detail.status === "Pending";
  const publishedTrail = detail.status === "Approved" ? detail.publishedTrailIdentifier : null;
  const editable = pending || Boolean(publishedTrail);
  const fieldsDirty = !sameFields(fields, fieldsOf(detail));
  const saving = saveRoute.isPending || saveDetails.isPending;

  const afterSave = (updated: AdminHikeSubmissionResponse) => {
    if (updated.publishedTrailIdentifier) void invalidateTrails();
  };

  const onSaveRoute = () =>
    saveRoute.mutate(serializeCoordinates(editor.kept), {
      onSuccess: (updated) => {
        editor.reset(parseCoordinates(updated.coordinates));
        afterSave(updated);
      },
    });

  const onSaveDetails = () =>
    saveDetails.mutate(toUpdateRequest(fields, detail.lastUpdatedAt), {
      onSuccess: (updated) => {
        setFields(fieldsOf(updated));
        afterSave(updated);
      },
    });

  const backToList = () => void navigate(LIST);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <BackLink />
          <h1 className="text-2xl font-semibold">{detail.name}</h1>
          <p className="text-sm text-muted-foreground">
            Submitted {new Date(detail.createdAt).toLocaleString("sv-SE")} by{" "}
            {detail.submitterNickName ?? "a deleted account"} · nickname {detail.showSubmitterName ? "shown" : "hidden"}{" "}
            · transfer accepted {new Date(detail.transferAcceptedAt).toLocaleString("sv-SE")}
          </p>
        </div>
        <Badge variant={pending ? "secondary" : "outline"}>{detail.status}</Badge>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section className="min-w-0 flex-[999_1_640px] space-y-3">
          {editable && (
            <RouteToolbar
              editor={editor}
              satellite={satellite}
              onToggleSatellite={() => setSatellite((s) => !s)}
              onResetToOriginal={() => editor.reset(parseCoordinates(detail.originalCoordinates))}
            />
          )}

          <SubmissionMap
            path={editor.path}
            keptRange={editor.range}
            jumps={editor.jumps}
            mode={editable ? editor.mode : "move"}
            satellite={satellite}
            redrawAnchors={
              editor.mode === "extend"
                ? [editor.extendFrom === "start" ? editor.range[0] : editor.range[1]]
                : editor.anchors
            }
            draft={editor.draft}
            focus={focus}
            onMovePoint={(index, to) => editable && editor.movePoint(index, to)}
            onInsertPoint={(afterIndex, at) => editable && editor.insertPoint(afterIndex, at)}
            onPointClick={editor.clickPoint}
            onMapClick={editor.clickMap}
          />

          {editable && <RouteModePanel editor={editor} />}
          <p className="text-xs text-muted-foreground">
            Zoom in to see every GPS point. Move point: drag a point, or drag a small handle between two points to add
            one. Delete point: click it. Cut section: click two points to remove what lies between. Redraw section:
            click two points, then click the new path between them. Extend: draw onward from the start or end. Set
            start: click a point; a loop is turned to begin there, any other walk is trimmed to it.
          </p>
          {publishedTrail && (
            <p className="text-sm text-muted-foreground">
              This walk is published. Saved changes go straight to trail {publishedTrail}.
            </p>
          )}
        </section>

        <aside className="min-w-0 flex-[1_1_340px] space-y-4">
          {editable && <TrimCard editor={editor} savedPath={savedPath} saving={saving} onSave={onSaveRoute} />}

          <SimilarRoutesCard identifier={identifier} />

          <JumpsCard editor={editor} onFocus={setFocus} />

          <SubmissionDetailsCard
            fields={fields}
            editable={editable}
            dirty={fieldsDirty}
            saving={saving}
            onChange={setFields}
            onSave={onSaveDetails}
          />

          <SubmissionPhotosCard
            detail={detail}
            pending={pending}
            trailPhotos={
              publishedTrail && (
                <>
                  <p className="text-sm text-muted-foreground">
                    The photos now belong to the published trail. Add your own or remove the example images there.
                  </p>
                  <TrailImagesDialog
                    data={{ identifier: publishedTrail, name: fields.name }}
                    selected
                    label="Manage photos"
                  />
                </>
              )
            }
          />

          {pending ? (
            <DecisionCard
              detail={detail}
              unsaved={editor.dirty || fieldsDirty}
              onApproved={() => {
                void invalidateTrails();
                backToList();
              }}
              onRejected={backToList}
            />
          ) : (
            <DecidedCard detail={detail} />
          )}
        </aside>
      </div>
    </>
  );
}
