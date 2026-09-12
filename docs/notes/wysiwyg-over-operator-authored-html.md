# A WYSIWYG over HTML somebody else wrote rewrites it by default, and three TipTap defaults are how

`MailTemplates` exists so mail copy can be corrected without a deploy. The rows are therefore
**operator-authored HTML** — some of it hand-written as SQL on the host — and the editor built
over it in `web/src/components/mail/` has one obligation above every other: *never change a
body nobody asked to change.*

Nothing about that is the default. Measured against `@tiptap/*` 3.31.3 while building it.

## The load-bearing rule: dirtiness must come from EVENTS, not from comparing strings

No schema-based editor reproduces stored HTML byte for byte, and two differences appear on
every real row here:

- the seeded bodies have literal `\n` between their `<p>` blocks; ProseMirror emits none;
- style **values** are re-serialised (below).

So `bodyHtml !== loadedHtml` is true from the moment the page renders. Wire "has this changed"
to that comparison and **opening each template in turn rewrites every one of them** — the
worst possible outcome for a table whose entire purpose is that an operator's wording survives.

`mail-template-page.tsx` therefore sets `dirty` only in `onUpdate` / `onChange` handlers, and
seeds with `emitUpdate: false`. Proved by mutation: adding the naive
`useEffect(() => onChange(editor.getHTML()), [editor])` "keep the parent in sync" effect turns
**five** tests in `mail-template-page.test.tsx` red, starting with *cannot be saved until
something is actually edited*.

## Three TipTap defaults that invent or destroy markup

**1. `Link` injects `rel` and `target`, and `HTMLAttributes: {}` does not clear them.**
The defaults are `target="_blank"` and `rel="noopener noreferrer nofollow"`. Passing an empty
object does **not** override them — measured, they still came out. They have to be nulled by
name, and `mergeAttributes` then drops them:

```ts
Link.configure({ HTMLAttributes: { target: null, rel: null }, autolink: false, linkOnPaste: false })
```

Left alone, every template containing a link differs the moment it is opened. `autolink` is
the same class of problem: it turns typed text into links behind the operator's back.

**2. `setContent`'s `emitUpdate` defaults to `true`.** (`SetContentOptions` in
`@tiptap/core/dist/index.d.ts` states the default outright.) Seeding the editor is a *load*,
not an edit, so the default makes a load announce itself as a change — feeding straight into
the rule above.

**3. Unknown attributes are dropped.** Mail is styled inline, so the default schema turns the
verification button's `style="display:inline-block;padding:12px 20px;background:#3f6b43;…"`
into a plain link. A global passthrough attribute is preferred to a dedicated `Button` node
matched on a known style string: passthrough preserves *any* operator's markup, where a
matched node silently loses whatever differs from the preset.

## Style values are re-serialised, and it is not jsdom

ProseMirror writes the attribute as `element.style.cssText`, not `setAttribute`, so the CSSOM
reparses it: `#3f6b43` comes back as `rgb(63, 107, 67)` and `padding:12px 20px` gains spaces.

The tempting conclusion is "a test artefact". It is not. Measured directly: jsdom leaves a
`setAttribute("style", …)` value **completely untouched** through `outerHTML`, so the editor is
doing this and a real browser does it too. Two consequences worth keeping:

- recognising a preset (`isButtonLink`) must compare *normalised* declaration values, or a
  button stops being recognised the moment it has been through the editor once, and the
  toolbar lies;
- it is a change of bytes and not of meaning, so it belongs in the "equivalent" tier below.

## Detect loss, do not compare for equality

Asking *are these equal* is useless: it fires on 100% of real inputs and gets switched off on
day one. `detectLoss` in [`web/src/lib/mail-template.ts`](../../web/src/lib/mail-template.ts)
asks the answerable question instead — **did anything disappear** (tokens, elements,
attributes, wording) — which is blind to formatting by construction. Three verdicts follow:
`identical`, `equivalent` (nothing lost, bytes differ — normal) and `lossy` (open the HTML
source view and say what would go).

`{{ A }}` normalising to `{{A}}` is deliberately *equivalent*: `MailTemplateRenderer` treats
them as one placeholder, so `normalizeText` canonicalises placeholder spacing before
comparing. Without that, an ordinary template reads as lossy.

## Two build and test mechanics

- **`@tiptap/pm` cannot be a `manualChunks` id.** It is a namespace package with subpath
  exports only and no `"."` entry, so listing it fails the build outright with *Missing "."
  specifier*. List the other `@tiptap/*` packages; its prosemirror modules follow their
  importers into the same chunk. (`npm ls prosemirror-model` showed a single deduped copy, so
  the `resolve.dedupe` workaround was not needed.)
- **jsdom cannot type into a contenteditable at all**, so no test drives the editor by typing.
  But ProseMirror's parser and serializer are pure DOM-API code with no layout dependency, so
  a **headless `new Editor({ extensions, content })` plus `getHTML()` works** — which makes
  round-trip fidelity against the real seeded bodies testable, and that is the part worth
  testing. See `mail-editor-schema.test.ts`.

Related: [[mail-templates-seeded-with-insertdata]] for why the rows are operator-owned in the
first place, [[web-vitest-environment]] for the rest of what jsdom substitutes, and
[[userevent-type-eats-double-braces]] for the trap in testing any of this.
