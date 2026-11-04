// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { EyeOff, ImageIcon, Star } from "lucide-react";
import type { DashboardReview } from "@/features/dashboard/api/dashboard";
import { relativeTime } from "@/features/dashboard/utils/dashboard";
import { cn } from "@/lib/utils";
import { TONES } from "./dashboard-cards";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "size-3.5",
            n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

export function ReviewRow({ review }: { review: DashboardReview }) {
  const author = review.authorNickName ?? "Deleted user";

  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          TONES.violet.chip,
        )}
        aria-hidden
      >
        {author.charAt(0).toUpperCase()}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{author}</span>
          <span className="text-muted-foreground">on</span>
          <span className="font-medium">{review.trailName}</span>
          <Stars rating={review.rating} />
          {review.isHidden && (
            <span className={cn("flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-xs", TONES.amber.chip)}>
              <EyeOff className="size-3" /> Hidden
            </span>
          )}
        </div>
        {review.text ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">{review.text}</p>
        ) : (
          <p className="text-muted-foreground/70 text-sm italic">No text, just a rating</p>
        )}
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          <span>{relativeTime(review.createdAt)}</span>
          {review.imageCount > 0 && (
            <span className="flex items-center gap-1">
              <ImageIcon className="size-3" /> {review.imageCount}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
