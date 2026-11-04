// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import type { AdminHikeSubmissionResponse } from "@/api/generated/model";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeleteSubmissionImage } from "@/features/hike-submissions/api/hike-submissions";

interface Props {
  detail: AdminHikeSubmissionResponse;
  pending: boolean;
  // keep-comment: replaces the empty-state text once the photos belong to a published trail
  trailPhotos?: ReactNode;
}

export function SubmissionPhotosCard({ detail, pending, trailPhotos }: Props) {
  const remove = useDeleteSubmissionImage(detail.identifier);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Photos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {trailPhotos ??
          (detail.images.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No photos. The trail gets the example images; you can replace them on the trail afterwards.
            </p>
          ))}
        <div className="flex flex-wrap gap-2">
          {detail.images.map((image) => (
            <div key={image.identifier} className="relative">
              <img src={image.imageUrl} alt="" className="h-20 w-28 rounded-[5px] object-cover" />
              {pending && (
                <button
                  type="button"
                  aria-label="Remove photo"
                  disabled={remove.isPending}
                  className="absolute right-1 top-1 rounded-[5px] bg-background/90 p-1"
                  onClick={() => remove.mutate(image.identifier)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
