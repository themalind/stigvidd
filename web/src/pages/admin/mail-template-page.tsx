// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link as RouterLink } from "react-router";
import { toast } from "sonner";
import { AlertTriangle, Eye, Loader2, Save, Wand2 } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MailBodyEditor from "@/components/mail/mail-body-editor";
import MailPreview from "@/components/mail/mail-preview";
import MailSourceTextarea from "@/components/mail/mail-source-textarea";
import TokenPalette from "@/components/mail/token-palette";
import {
  getMailTemplate,
  previewMailTemplate,
  updateMailTemplate,
} from "@/api/mail-templates";
import {
  detectLoss,
  htmlToPlainText,
  insertTokenAt,
  limits,
  reviewTokens,
  tokenText,
  verdictFor,
} from "@/lib/mail-template";
import { roundTripThroughSchema } from "@/components/mail/mail-editor-schema";
import type { MailTemplate, MailTemplatePreview } from "@/types/types";

type Field = "subject" | "bodyHtml" | "bodyText";

export default function MailTemplatePage() {
  const { identifier = "" } = useParams();

  const [template, setTemplate] = useState<MailTemplate | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [description, setDescription] = useState("");

  // Derived from edit EVENTS, never by comparing strings against what was loaded. A
  // string-derived flag would be true from the moment the page opened -- the editor cannot
  // reproduce a stored body byte for byte -- and every visit would rewrite the row.
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<MailTemplatePreview | null>(null);

  const [focused, setFocused] = useState<Field | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const handleEditorReady = useCallback((instance: Editor | null) => {
    editorRef.current = instance;
  }, []);

  const load = useCallback(async () => {
    try {
      const loaded = await getMailTemplate(identifier);
      setTemplate(loaded);
      setSubject(loaded.subject);
      setBodyHtml(loaded.bodyHtml);
      setBodyText(loaded.bodyText);
      setDescription(loaded.description ?? "");
      setDirty(false);
    } catch (err) {
      setLoadFailed(true);
      toast.error(err instanceof Error ? err.message : "Could not load the template.");
    }
  }, [identifier]);

  useEffect(() => {
    void load();
  }, [load]);

  // Against template.bodyHtml — the row as loaded — not the live draft. The verdict is a
  // statement about the stored markup, and recomputing it from edited content would let it
  // drift as the operator types (and would re-run a full headless parse each time).
  const roundTrip = useMemo(() => {
    const stored = template?.bodyHtml ?? "";
    const rendered = roundTripThroughSchema(stored);
    const loss = detectLoss(stored, rendered);

    return { loss, verdict: verdictFor(stored, rendered, loss) };
  }, [template?.bodyHtml]);

  const review = useMemo(
    () =>
      reviewTokens(
        { subject, bodyHtml, bodyText },
        // null means "nothing declares this key", which is NOT the same as an empty token
        // list. Passing [] here would condemn every placeholder in an orphaned row and
        // refuse to save it -- the opposite of what the API does for the same row.
        template && template.isKnown ? template.tokens : null,
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

  async function handlePreview() {
    setPreviewing(true);
    try {
      // Through the API's real renderer, so a draft that would fail at enqueue fails here
      // first -- with the same message, and before it is saved.
      setPreview(await previewMailTemplate(identifier, { subject, bodyHtml, bodyText }));
    } catch (err) {
      setPreview(null);
      toast.error(err instanceof Error ? err.message : "Could not render the preview.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await updateMailTemplate(identifier, {
        subject,
        bodyHtml,
        bodyText,
        description: description.trim() === "" ? null : description,
      });
      setTemplate(saved);
      setDirty(false);
      toast.success("Template saved. The next mail sent will use it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the template.");
    } finally {
      setSaving(false);
    }
  }

  if (loadFailed) {
    return (
      <main className="container mx-auto max-w-3xl py-10">
        <Card>
          <CardHeader>
            <CardTitle>Template not available</CardTitle>
            <CardDescription>
              It could not be loaded, so there is nothing safe to edit here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <RouterLink to="/mail-templates">Back to templates</RouterLink>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!template) {
    return (
      <main className="container mx-auto max-w-6xl space-y-4 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="font-mono">
            {template.key}
            <span className="text-muted-foreground"> / {template.language}</span>
          </CardTitle>
          <CardDescription>
            {template.purpose ?? (
              <>
                No code declares this template key, so nothing sends it and there is no list of
                placeholders it may use.
              </>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            The key and language identify which code sends this mail, so they cannot be changed
            here.
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
            <CardDescription>
              Every mail goes out with both an HTML and a plain-text version.
            </CardDescription>
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
                  Only rewritten when you press the button — a hand-tuned plain-text version is
                  never overwritten on save.
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
              This mail will not contain{" "}
              {review.missing.map((name) => tokenText(name)).join(", ")}
            </CardTitle>
            <CardDescription>
              That is allowed and the mail will send — but the recipient will not get{" "}
              {review.missing.length === 1 ? "that value" : "those values"}. For a verification
              mail, that means no way to verify.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Preview and save</CardTitle>
          <CardDescription>
            The preview runs the same renderer a real send uses, with sample values.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handlePreview} disabled={previewing}>
              {previewing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              {previewing ? "Rendering…" : "Preview"}
            </Button>

            <Button type="button" onClick={handleSave} disabled={!dirty || blocked || saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>

          {blocked && (
            <p className="text-sm text-destructive">
              Saving is blocked: {review.unknown.map((name) => tokenText(name)).join(", ")}{" "}
              {review.unknown.length === 1 ? "is not supplied" : "are not supplied"} for this
              template, and a mail using one never sends.
            </p>
          )}

          {!dirty && !blocked && (
            <p className="text-sm text-muted-foreground">
              No changes yet. Nothing is written until you edit something.
            </p>
          )}

          {preview && <MailPreview preview={preview} />}
        </CardContent>
      </Card>
    </main>
  );
}
