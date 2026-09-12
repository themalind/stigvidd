// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  AlertTriangle,
  Bold,
  Code2,
  Italic,
  Link2,
  List,
  ListOrdered,
  MousePointerClick,
  Pilcrow,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buttonLinkStyle,
  codeParagraphStyle,
  describeLoss,
  embedTokenPlaceholders,
  isButtonLink,
  isCodeParagraph,
  isSafeMailUrl,
  tokenText,
  unwrapTokenPlaceholders,
  type LossReport,
  type RoundTripVerdict,
} from "@/lib/mail-template";
import { mailEditorExtensions } from "./mail-editor-schema";
import MailSourceTextarea from "./mail-source-textarea";
import type { MailTemplateToken } from "@/types/types";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (bodyHtml: string) => void;
  tokens: MailTemplateToken[];
  /**
   * What a trip through the schema would do to the body AS STORED. Computed by the page from
   * the loaded row rather than here, so that switching tabs — which unmounts this component —
   * cannot re-derive the verdict from content the operator has since edited.
   */
  roundTrip: { loss: LossReport; verdict: RoundTripVerdict };
  /** Told which editor is live, so the token palette inserts into the right place. */
  onEditorReady?: (editor: Editor | null) => void;
  onFocus?: () => void;
};

/**
 * The visual editor for BodyHtml, with an HTML source view beside it.
 *
 * The rule that everything else here serves: THE PAGE NEVER SAVES A BODY THE OPERATOR DID NOT
 * EDIT. No schema-based editor reproduces a stored mail body byte for byte -- the seeded rows
 * have newlines between their <p> blocks and the CSSOM re-serialises style values -- so if
 * "has this changed" were answered by comparing strings, it would be true the moment the page
 * loaded and merely opening a template would rewrite it. Dirtiness is therefore derived from
 * edit EVENTS, and the editor is seeded with `emitUpdate: false`.
 */
export default function MailBodyEditor({
  value,
  onChange,
  tokens,
  roundTrip,
  onEditorReady,
  onFocus,
}: Props) {
  const [requestedMode, setRequestedMode] = useState<"visual" | "source">("visual");
  const [overrideLoss, setOverrideLoss] = useState(false);

  const lossy = roundTrip.verdict === "lossy";

  // Derived rather than pushed into state by an effect: a body the visual editor would mangle
  // is simply not shown in it until the operator has said, deliberately, that they accept the
  // loss. Expressing that as a rule instead of a side effect also means there is no render in
  // which the wrong view is on screen.
  const mode = lossy && !overrideLoss ? "source" : requestedMode;

  const editor = useEditor({
    extensions: mailEditorExtensions,
    content: embedTokenPlaceholders(value),
    editorProps: {
      attributes: {
        class:
          "prose-mail min-h-[22rem] rounded-xs border border-input bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
      },
      // Paste goes through the same pure function as the initial load, so pasted
      // {{NickName}} becomes a chip and a pasted href="{{Url}}" is not mangled.
      transformPastedHTML: (html) => embedTokenPlaceholders(html),
    },
    onUpdate: ({ editor: instance }) => {
      onChange(unwrapTokenPlaceholders(instance.getHTML()));
    },
    onFocus: () => onFocus?.(),
  });

  const seededFor = useRef<string | null>(value);

  useEffect(() => {
    onEditorReady?.(editor ?? null);
  }, [editor, onEditorReady]);

  function toVisual() {
    if (!editor) return;

    // setContent is called exactly here and at construction -- never from an effect on
    // `value`. Doing that is the classic controlled-editor clobber: every keystroke would
    // reset the document, killing the selection, the undo stack and every chip.
    //
    // `emitUpdate` DEFAULTS TO TRUE in TipTap 3 (see SetContentOptions), and seeding is a
    // load rather than an edit: left at the default, switching to the visual view would mark
    // the template dirty without anybody typing, and the next Save would write a body nobody
    // touched.
    if (seededFor.current !== value) {
      editor.commands.setContent(embedTokenPlaceholders(value), { emitUpdate: false });
      seededFor.current = value;
    }

    setRequestedMode("visual");
  }

  const linkAttrs = editor?.getAttributes("link") as { href?: string } | undefined;
  const paragraphStyle = editor?.getAttributes("paragraph").style as string | undefined;

  return (
    <div className="space-y-2">
      {lossy && (
        <div className="rounded-xs border border-destructive bg-destructive/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            The visual editor would change this markup
          </p>
          <p className="mt-1 text-muted-foreground">{describeLoss(roundTrip.loss)}</p>

          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={overrideLoss}
              onChange={(event) => setOverrideLoss(event.target.checked)}
            />
            I understand the listed markup will be removed
          </label>
        </div>
      )}

      <Tabs
        value={mode}
        onValueChange={(next) => (next === "visual" ? toVisual() : setRequestedMode("source"))}
      >
        <TabsList>
          <TabsTrigger value="visual" disabled={lossy && !overrideLoss}>
            Visual
          </TabsTrigger>
          <TabsTrigger value="source">HTML source</TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="space-y-2">
          {editor && (
            <>
              <div className="flex flex-wrap items-center gap-1 rounded-xs border border-input p-1">
                <ToolbarButton
                  label="Bold"
                  icon={<Bold className="size-4" />}
                  active={editor.isActive("bold")}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                />
                <ToolbarButton
                  label="Italic"
                  icon={<Italic className="size-4" />}
                  active={editor.isActive("italic")}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                />
                <ToolbarButton
                  label="Bullet list"
                  icon={<List className="size-4" />}
                  active={editor.isActive("bulletList")}
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                />
                <ToolbarButton
                  label="Numbered list"
                  icon={<ListOrdered className="size-4" />}
                  active={editor.isActive("orderedList")}
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                />

                <Separator orientation="vertical" className="mx-1 h-6" />

                <LinkControl editor={editor} tokens={tokens} currentHref={linkAttrs?.href} />

                <ToolbarButton
                  label="Remove link"
                  icon={<Unlink className="size-4" />}
                  disabled={!editor.isActive("link")}
                  onClick={() => editor.chain().focus().unsetLink().run()}
                />

                <Separator orientation="vertical" className="mx-1 h-6" />

                {/* Presets write a known style into the passthrough attribute. Recognition is
                    fuzzy so a hand-written variant still lights up; rewriting only ever
                    happens because somebody pressed this. */}
                <ToolbarButton
                  label="Style as button"
                  icon={<MousePointerClick className="size-4" />}
                  active={isButtonLink(linkAttrs ? (editor.getAttributes("link").style as string) : null)}
                  disabled={!editor.isActive("link")}
                  onClick={() =>
                    editor.chain().focus().updateAttributes("link", { style: buttonLinkStyle }).run()
                  }
                />
                <ToolbarButton
                  label="Style as code"
                  icon={<Code2 className="size-4" />}
                  active={isCodeParagraph(paragraphStyle)}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .updateAttributes("paragraph", {
                        style: isCodeParagraph(paragraphStyle) ? null : codeParagraphStyle,
                      })
                      .run()
                  }
                />
                <ToolbarButton
                  label="Clear paragraph styling"
                  icon={<Pilcrow className="size-4" />}
                  onClick={() =>
                    editor.chain().focus().updateAttributes("paragraph", { style: null }).run()
                  }
                />
              </div>

              <EditorContent editor={editor} />

              <p className="text-xs text-muted-foreground">
                Placeholders show as chips. They cannot be edited in place — insert or delete
                them whole, so one can never be half-deleted into something that stops the mail.
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="source">
          <MailSourceTextarea
            // Deliberately not "HTML source": Radix labels the tab PANEL by its trigger's
            // text, so that name would match two elements.
            aria-label="HTML source code"
            value={value}
            onFocus={() => onFocus?.()}
            onChange={(event) => {
              onChange(event.target.value);
              // The visual editor is now behind; reseed it on the next switch.
              seededFor.current = null;
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToolbarButton({
  label,
  icon,
  onClick,
  active,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}

/**
 * The link dialog, whose whole reason for existing is that a placeholder cannot be a node
 * inside an attribute. `{{VerificationUrl}}` has to be choosable as a URL, or the verification
 * button cannot be built here at all.
 */
function LinkControl({
  editor,
  tokens,
  currentHref,
}: {
  editor: Editor;
  tokens: MailTemplateToken[];
  currentHref?: string;
}) {
  const [href, setHref] = useState("");
  const [open, setOpen] = useState(false);

  const invalid = href.trim().length > 0 && !isSafeMailUrl(href);

  function apply(next: string) {
    if (!isSafeMailUrl(next)) return;

    editor.chain().focus().extendMarkRange("link").setLink({ href: next }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setHref(currentHref ?? "");
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          aria-label="Link"
          title="Link"
        >
          <Link2 className="size-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="mail-link-href">Web address</Label>
          <Input
            id="mail-link-href"
            value={href}
            placeholder="https://stigvidd.se"
            aria-invalid={invalid}
            onChange={(event) => setHref(event.target.value)}
          />
          {invalid && (
            <p className="text-xs text-destructive">
              Must be an absolute http(s), mailto: or tel: address, or a placeholder.
            </p>
          )}
        </div>

        {tokens.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Or link to a template value</p>
            <div className="flex flex-wrap gap-1">
              {tokens.map((token) => (
                <Button
                  key={token.name}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => apply(tokenText(token.name))}
                >
                  {token.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Button
          type="button"
          size="sm"
          className={cn("w-full")}
          disabled={invalid || href.trim().length === 0}
          onClick={() => apply(href.trim())}
        >
          Apply link
        </Button>
      </PopoverContent>
    </Popover>
  );
}
