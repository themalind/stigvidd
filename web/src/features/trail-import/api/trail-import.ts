// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getTrailImportCreateSessionUrl,
  getTrailImportGetDiffQueryOptions,
  getTrailImportGetPreviewQueryOptions,
  getTrailImportGetProposalsSuspenseQueryOptions,
  getTrailImportGetSessionsQueryKey,
  getTrailImportGetSessionsSuspenseQueryOptions,
  getTrailImportGetSessionSuspenseQueryOptions,
  trailImportAnalyze,
  trailImportApply,
  trailImportDecide,
  trailImportDecideBulk,
  trailImportDeleteSession,
  trailImportGetProposals,
} from "@/api/generated/trail-import/trail-import";
import type {
  DecideProposalRequest,
  TrailImportApplyResponse,
  TrailImportDiffResponse,
  TrailImportPreviewResponse,
  TrailImportProposalResponse,
  TrailImportSessionResponse,
} from "@/api/generated/model";
import { customFetch } from "@/api/mutator";
import { underUrl } from "@/lib/react-query";

export type Confidence = "Certain" | "High" | "Medium" | "Unmatched";
export type Decision = "Pending" | "Accept" | "Relink" | "CreateNew" | "Exclude" | "Skip";
/** What a linked feature contributes to the trail's route. */
export type LinkRole = "Segment" | "Duplicate" | "Excluded";
export type SessionStatus = "Uploaded" | "Analyzing" | "AwaitingReview" | "Applying" | "Applied" | "Failed";

/** Ascending order of how much a human is needed. Drives sorting and the summary row. */
export const confidenceOrder: Confidence[] = ["Unmatched", "Medium", "High", "Certain"];

export type Proposal = TrailImportProposalResponse;
export type Session = TrailImportSessionResponse;
export type Preview = TrailImportPreviewResponse;
export type Diff = TrailImportDiffResponse;
export type ApplyResult = TrailImportApplyResponse;

export const PROPOSALS_PAGE_SIZE = 50;
const SELECT_ALL_PAGE_SIZE = 200;
const ANALYSING_POLL_MS = 4000;

export interface ProposalFilters {
  confidence?: Confidence;
  decision?: Decision;
}

const SESSIONS_URL = getTrailImportGetSessionsQueryKey()[0];

export const sessionsQueryOptions = () => getTrailImportGetSessionsSuspenseQueryOptions();

// keep-comment: an analysing session has a worker holding it, and the full export takes tens of seconds
export const pollWhileAnalysing = (sessions: Session[] | undefined) =>
  sessions?.some((session) => session.status === "Analyzing") ? ANALYSING_POLL_MS : false;

export const sessionQueryOptions = (sessionId: number) => getTrailImportGetSessionSuspenseQueryOptions(sessionId);

export const proposalsQueryOptions = (sessionId: number, filters: ProposalFilters, page: number) =>
  getTrailImportGetProposalsSuspenseQueryOptions(sessionId, { ...filters, page, pageSize: PROPOSALS_PAGE_SIZE });

export const fetchProposalPage = (sessionId: number, filters: ProposalFilters, page: number) =>
  trailImportGetProposals(sessionId, { ...filters, page, pageSize: SELECT_ALL_PAGE_SIZE });

export function usePreview(sessionId: number, proposalId: number) {
  return useQuery(getTrailImportGetPreviewQueryOptions(sessionId, proposalId));
}

// keep-comment: read fresh every time it is opened, since it is what the apply button acts on
export function useDiff(sessionId: number, open: boolean) {
  return useQuery({ ...getTrailImportGetDiffQueryOptions(sessionId), enabled: open, staleTime: 0, gcTime: 0 });
}

// keep-comment: a decision moves the session's counts, its lists, the siblings in other previews and the diff
function useInvalidateSession() {
  const queryClient = useQueryClient();

  return (sessionId?: number) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [SESSIONS_URL], exact: true }),
      sessionId !== undefined && queryClient.invalidateQueries(underUrl(`${SESSIONS_URL}/${sessionId}`)),
    ]);
}

// keep-comment: the generated multipart function sends IFormFile's properties as fields instead of the file
function createSession(file: File, source?: string): Promise<Session> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  if (source) formData.append("source", source);

  return customFetch<Session>(getTrailImportCreateSessionUrl(), { method: "POST", body: formData });
}

export function useCreateSession() {
  const invalidate = useInvalidateSession();

  return useMutation({
    mutationFn: ({ file, source }: { file: File; source?: string }) => createSession(file, source),
    onSuccess: (session) => {
      if (session.duplicateOf && session.duplicateOf.length > 0) {
        toast.warning(
          `This file has been uploaded before (${session.duplicateOf.length} earlier session(s)). Analysing it again is fine.`,
          { duration: 8000 },
        );
      } else {
        toast.success(`${session.fileName} uploaded.`);
      }
      return invalidate();
    },
  });
}

// keep-comment: the API refuses to discard decided proposals unless forced, and says how many
function isDiscardRefusal(error: unknown): error is Error {
  return error instanceof Error && error.message.includes("discard");
}

interface AnalyzeVariables {
  sessionId: number;
  confirmDiscard: (message: string) => boolean;
}

export function useAnalyzeSession() {
  const invalidate = useInvalidateSession();

  return useMutation({
    mutationFn: async ({ sessionId, confirmDiscard }: AnalyzeVariables) => {
      try {
        return await trailImportAnalyze(sessionId, { force: false });
      } catch (error) {
        if (!isDiscardRefusal(error)) throw error;
        if (!confirmDiscard(error.message)) return null;
        return trailImportAnalyze(sessionId, { force: true });
      }
    },
    onSuccess: (session, { sessionId }) => {
      if (session) toast.success("Analysis queued. This page updates itself while it runs.");
      return invalidate(sessionId);
    },
  });
}

export function useDeleteSession() {
  const invalidate = useInvalidateSession();

  return useMutation({
    mutationFn: (sessionId: number) => trailImportDeleteSession(sessionId),
    onSuccess: () => invalidate(),
    meta: { successMessage: "Session deleted." },
  });
}

export function useDecideProposal(sessionId: number, proposalId: number) {
  const invalidate = useInvalidateSession();

  return useMutation({
    mutationFn: (request: DecideProposalRequest) => trailImportDecide(sessionId, proposalId, request),
    // keep-comment: not awaited, so the caller steps to the next row before the decided one leaves the list
    onSuccess: () => {
      void invalidate(sessionId);
    },
  });
}

export function useDecideBulk(sessionId: number) {
  const invalidate = useInvalidateSession();

  return useMutation({
    mutationFn: ({ proposalIds, decision }: { proposalIds: number[]; decision: Decision }) =>
      trailImportDecideBulk(sessionId, { proposalIds, decision }),
    onSuccess: ({ decided }, { decision }) => {
      toast.success(`${decided} proposal(s) set to ${decision}.`);
      return invalidate(sessionId);
    },
  });
}

/** The destructive one: writes the decisions to Trails and their source links. */
export function useApplySession(sessionId: number) {
  const invalidate = useInvalidateSession();

  return useMutation({
    mutationFn: () => trailImportApply(sessionId),
    onSuccess: (result) => {
      toast.success(
        `Applied: ${result.trailsCreated} created, ${result.trailsUpdated} updated, ${result.linksWritten} links written.`,
      );
      return invalidate(sessionId);
    },
    meta: { errorMessage: "The session could not be applied." },
  });
}
