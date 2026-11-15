// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { LoaderFunction } from "react-router";
import {
  DatabaseBackup,
  Flag,
  Footprints,
  Gauge,
  HeartHandshake,
  Images,
  Import,
  Inbox,
  Mail,
  Mails,
  MapPinned,
  Route,
  Send,
  Settings2,
  Tent,
  Upload,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { AttentionKey } from "@/api/attention";
import { paths } from "@/config/paths";
import { detailLoaders } from "./loaders";
import { queryClient } from "./query-client";

export interface AppPage {
  path: string;
  title: string;
  component: LazyExoticComponent<ComponentType>;
  // keep-comment: a page with an icon is listed in the sidebar, in this order
  icon?: LucideIcon;
  group?: NavGroup;
  // keep-comment: the count of work waiting on this page, shown beside it in the sidebar
  badge?: AttentionKey;
  loader?: LoaderFunction;
}

export interface NavGroup {
  title: string;
  icon: LucideIcon;
}

const contributions: NavGroup = { title: "Contributions", icon: Inbox };
const imports: NavGroup = { title: "Import", icon: Import };
const community: NavGroup = { title: "Community", icon: HeartHandshake };
const mail: NavGroup = { title: "Mail", icon: Mails };

const loaders = detailLoaders(queryClient);

export const pages: AppPage[] = [
  {
    path: paths.dashboard,
    title: "Dashboard",
    icon: Gauge,
    component: lazy(() => import("./routes/dashboard")),
  },
  {
    path: paths.trails(),
    title: "Trails",
    icon: Settings2,
    component: lazy(() => import("./routes/trails")),
  },
  {
    path: paths.areas,
    title: "Areas",
    icon: MapPinned,
    component: lazy(() => import("./routes/city-areas")),
  },
  {
    path: paths.facilities(),
    title: "Facilities",
    icon: Tent,
    component: lazy(() => import("./routes/facilities")),
  },
  {
    path: paths.media,
    title: "Media Library",
    icon: Images,
    component: lazy(() => import("./routes/media")),
  },
  {
    path: paths.userWalks(),
    title: "User Walks",
    icon: Footprints,
    group: contributions,
    component: lazy(() => import("./routes/user-walks")),
  },
  {
    path: paths.hikeSubmissions,
    title: "Hike Submissions",
    icon: Upload,
    group: contributions,
    badge: "pendingHikeSubmissions",
    component: lazy(() => import("./routes/hike-submissions")),
  },
  {
    path: paths.hikeSubmission(":identifier"),
    title: "Review Submission",
    component: lazy(() => import("./routes/hike-submission-review")),
    loader: loaders.hikeSubmission,
  },
  {
    path: paths.trailImport,
    title: "Trail Import",
    icon: Route,
    group: imports,
    badge: "importsAwaitingReview",
    component: lazy(() => import("./routes/trail-import")),
  },
  {
    path: paths.trailImportSession(":sessionId"),
    title: "Review Import",
    component: lazy(() => import("./routes/trail-import-review")),
    loader: loaders.trailImportSession,
  },
  {
    path: paths.facilityImport,
    title: "Facility Import",
    icon: Waves,
    group: imports,
    component: lazy(() => import("./routes/facility-import")),
  },
  {
    path: paths.users,
    title: "Users",
    icon: Users,
    group: community,
    component: lazy(() => import("./routes/users")),
  },
  {
    path: paths.moderation,
    title: "Moderation",
    icon: Flag,
    group: community,
    badge: "pendingReports",
    component: lazy(() => import("./routes/moderation")),
  },
  {
    path: paths.mailTemplates,
    title: "Mail Templates",
    icon: Mail,
    group: mail,
    component: lazy(() => import("./routes/mail-templates")),
  },
  {
    path: paths.mailTemplate(":identifier"),
    title: "Edit Mail Template",
    component: lazy(() => import("./routes/mail-template")),
    loader: loaders.mailTemplate,
  },
  {
    path: paths.mailOutbox(),
    title: "Mail Outbox",
    icon: Send,
    group: mail,
    badge: "failedMails",
    component: lazy(() => import("./routes/mail-outbox")),
  },
  {
    path: paths.migration,
    title: "Migration",
    icon: DatabaseBackup,
    component: lazy(() => import("./routes/migration")),
  },
];
