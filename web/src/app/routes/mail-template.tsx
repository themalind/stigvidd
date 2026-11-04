// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, Link as RouterLink } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Eye, Loader2, Save, Wand2 } from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { MailTemplateResponse } from "@/api/generated/model";
import { Page } from "@/components/page";
import { paths } from "@/config/paths";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MailBodyEditor from "@/features/mail/components/mail-body-editor";
import MailPreview from "@/features/mail/components/mail-preview";
import MailSourceTextarea from "@/features/mail/components/mail-source-textarea";
import TokenPalette from "@/features/mail/components/token-palette";
import {
  mailTemplateQueryOptions,
  usePreviewMailTemplate,
  useSaveMailTemplate,
} from "@/features/mail/api/mail-templates";
import {
  detectLoss,
  htmlToPlainText,
  insertTokenAt,
  limits,
  reviewTokens,
  tokenText,
  verdictFor,
} from "@/features/mail/utils/mail-template";
import { roundTripThroughSchema } from "@/features/mail/components/mail-editor-schema";

type Field = "subject" | "bodyHtml" | "bodyText";

export default function MailTemplatePage() {
  const { identifier = "" } = useParams();

  return (
    <QueryBoundary resetKeys={[identifier]} errorFallback={() => <TemplateUnavailable />}>
      <LoadedTemplate identifier={identifier} />
    </QueryBoundary>
  );
}

function TemplateUnavailable() {
  return (
    <Page width="narrow">
      <Card>
        <CardHeader>
          <CardTitle>Template not available</CardTitle>
          <CardDescription>It could not be loaded, so there is nothing safe to edit here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <RouterLink to={paths.mailTemplates}>Back to templates</RouterLink>
          </Button>
        </CardContent>
      </Card>
    </Page>
  );
}

function LoadedTemplate({ identifier }: { identifier: string }) {
  const { data: template } = useSuspenseQuery(mailTemplateQueryOptions(identifier));

  return <TemplateEditor key={identifier} identifier={identifier} template={template} />;
}

function TemplateEditor({ identifier, template }: { identifier: string; template: MailTemplateResponse }) {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.bodyHtml);
  const [bodyText, setBodyText] = useState(template.bodyText);
  const [description, setDescription] = useState(template.description ?? "");

  // Set by edit events, not string comparison: the editor cannot reproduce a stored body byte for byte. keep-comment: non-obvious
  const [dirty, setDirty] = useState(false);

  const save = useSaveMailTemplate(identifier);
  const preview = usePreviewMailTemplate(identifier);

  const [focused, setFocused] = useState<Field | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const handleEditorReady = useCallback((instance: Editor | null) => {
    editorRef.current = instance;
  }, []);

  // The verdict is about the stored markup, so it reads the loaded row, not the draft. keep-comment: non-obvious
  const roundTrip = useMemo(() => {
    const stored = template.bodyHtml;
    const rendered = roundTripThroughSchema(stored);
    const loss = detectLoss(stored, rendered);

    return { loss, verdict: verdictFor(stored, rendered, loss) };
  }, [template.bodyHtml]);

  const review = useMemo(
    () =>
      reviewTokens(
        { subject, bodyHtml, bodyText },
        // null = no declared key (orphan, API allows save); [] would block every placeholder. keep-comment: non-obvious
        template.isKnown ? template.tokens : null,
      ),
    [subject, bodyHtml, bodyText, template],
  );

  const blocked = review.unknown.length > 0;

  function insertToken(name: string) {
    if (focused === "subject" && subjectRef.current) {
      const element = subjectRef.current;
      const { value, caret } = insertTokenAt(
        subject,
        element.selectionStart ?? subject.length,
        element.selectionEnd ?? subject.length,
        name,
      );
      setSubject(value);
      setDirty(true);
      requestAnimationFrame(() => {
        element.focus();
        element.setSelectionRange(caret, caret);
      });
      return;
    }

    if (focused === "bodyText" && bodyTextRef.current) {
      const element = bodyTextRef.current;
      const { value, caret } = insertTokenAt(
        bodyText,
        element.selectionStart ?? bodyText.length,
        element.selectionEnd ?? bodyText.length,
        name,
      );
      setBodyText(value);
      setDirty(true);
      requestAnimationFrame(() => {
        element.focus();
        element.setSelectionRange(caret, caret);
      });
      return;
    }

    if (focused === "bodyHtml" && editorRef.current) {
      editorRef.current.chain().focus().insertContent({ type: "mailToken", attrs: { name } }).run();
    }
  }

  function handlePreview() {
    preview.mutate({ subject, bodyHtml, bodyText });
  }

  function handleSave() {
    save.mutate(
      { subject, bodyHtml, bodyText, description: description.trim() === "" ? null : description },
      { onSuccess: () => setDirty(false) },
    );
  }

  return (
    <Page width="wide">
      <Card>
        <CardHeader>
          <CardTitle className="font-mono">
            {template.key}
            <span className="text-muted-foreground"> / {template.language}</span>
          </CardTitle>
          <CardDescription>
            {template.purpose ?? (
              <>
                No code declares this template key, so nothing sends it and there is no list of placeholders it may use.
              </>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            The key and language identify which code sends this mail, so they cannot be changed here.
          </p>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="template-subject">Subject</Label>
              <span
                className={
                  subject.length > limits.subject ? "text-xs text-destructive" : "text-xs text-muted-foreground"
                }
              >
                {subject.length}/{limits.subject}
              </span>
            </div>
            <Input
              id="template-subject"
              ref={subjectRef}
              value={subject}
              onFocus={() => setFocused("subject")}
              onChange={(event) => {
                setSubject(event.target.value);
                setDirty(true);
              }}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="template-description">Notes for whoever edits this next</Label>
            <Input
              id="template-description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setDirty(true);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>Every mail goes out with both an HTML and a plain-text version.</CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="html">
              <TabsList>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="text">Plain text</TabsTrigger>
              </TabsList>

              <TabsContent value="html" className="pt-2">
                <MailBodyEditor
                  value={bodyHtml}
                  tokens={template.tokens}
                  roundTrip={roundTrip}
                  onFocus={() => setFocused("bodyHtml")}
                  onEditorReady={handleEditorReady}
                  onChange={(next) => {
                    setBodyHtml(next);
                    setDirty(true);
                  }}
                />
              </TabsContent>

              <TabsContent value="text" className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template-body-text">Plain-text version</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBodyText(htmlToPlainText(bodyHtml));
                      setDirty(true);
                      toast.success("Rewritten from the HTML version.");
                    }}
                  >
                    <Wand2 className="size-3" aria-hidden="true" />
                    Generate from HTML
                  </Button>
                </div>

                <MailSourceTextarea
                  id="template-body-text"
                  ref={bodyTextRef}
                  value={bodyText}
                  onFocus={() => setFocused("bodyText")}
                  onChange={(event) => {
                    setBodyText(event.target.value);
                    setDirty(true);
                  }}
                />

                <p className="text-xs text-muted-foreground">
                  Only rewritten when you press the button — a hand-tuned plain-text version is never overwritten on
                  save.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <TokenPalette
          tokens={template.tokens}
          used={review.used}
          unknown={review.unknown}
          insertTarget={
            focused === "subject"
              ? "subject"
              : focused === "bodyHtml"
                ? "HTML body"
                : focused === "bodyText"
                  ? "plain-text body"
                  : null
          }
          onInsert={insertToken}
        />
      </div>

      {review.missing.length > 0 && (
        <Card className="border-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertTriangle className="size-4" aria-hidden="true" />
              This mail will not contain {review.missing.map((name) => tokenText(name)).join(", ")}
            </CardTitle>
            <CardDescription>
              That is allowed and the mail will send — but the recipient will not get{" "}
              {review.missing.length === 1 ? "that value" : "those values"}. For a verification mail, that means no way
              to verify.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Preview and save</CardTitle>
          <CardDescription>The preview runs the same renderer a real send uses, with sample values.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handlePreview} disabled={preview.isPending}>
              {preview.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              {preview.isPending ? "Rendering…" : "Preview"}
            </Button>

            <Button type="button" onClick={handleSave} disabled={!dirty || blocked || save.isPending}>
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>

          {blocked && (
            <p className="text-sm text-destructive">
              Saving is blocked: {review.unknown.map((name) => tokenText(name)).join(", ")}{" "}
              {review.unknown.length === 1 ? "is not supplied" : "are not supplied"} for this template, and a mail using
              one never sends.
            </p>
          )}

          {!dirty && !blocked && (
            <p className="text-sm text-muted-foreground">
              No changes yet. Nothing is written until you edit something.
            </p>
          )}

          {preview.data && <MailPreview preview={preview.data} />}
        </CardContent>
      </Card>
    </Page>
  );
}
