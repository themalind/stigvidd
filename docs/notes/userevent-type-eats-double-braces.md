# `userEvent.type` reads `{{` as an escape, so a test that types a `{{Placeholder}}` never types one

`@testing-library/user-event` v14 gives `{` and `[` meaning in the string it is handed: they
open keyboard descriptors like `{Enter}` or `{Shift>}`, and `{{` is the **escape for a literal
`{`**. So

```ts
await userEvent.type(source, "<p>Hej {{NickName}}</p>");
```

does not put `{{NickName}}` into the textarea. The mail templates in this repo substitute
`{{Placeholder}}` and nothing else, so every assertion about placeholders written this way
passes or fails for a reason unrelated to what it claims to test.

The symptom is not an error. It is a test that fails with something plausible-looking —
*Unable to find an element with the text `/^Saving is blocked:/`* — while the code under test
is correct and merely never received a placeholder. Measured in
`web/src/pages/admin/mail-template-page.test.tsx`, where three tests failed this way at once.

## What to do instead

Paste. It takes the string literally and has no descriptor syntax:

```ts
await userEvent.clear(field);
await userEvent.click(field);
await userEvent.paste("<p>Hej {{NickName}}</p>");
```

`fireEvent.change` also works for a plain textarea. Escaping (`{{{{NickName}}}}`) technically
works too and should be avoided — it is unreadable and the next person will "fix" it.

## The neighbouring trap in the same file

Radix `Tabs` gives the tab **panel** an `aria-labelledby` pointing at its trigger, so a panel
whose trigger reads *HTML source* is itself labelled "HTML source". A `getByLabelText("HTML
source")` for a textarea inside that panel then matches **two** elements. The textarea in
`mail-body-editor.tsx` is deliberately named `HTML source code` for that reason.

And a message whose text is split by an interpolated expression —
`Saving is blocked: {names} are not supplied` — is three text nodes, so a regex
`getByText` finds nothing. Match on `element.textContent` with a function matcher instead.

Related: [[web-vitest-environment]] for what else the web test environment quietly changes, and
[[wysiwyg-over-operator-authored-html]] for what these tests are guarding.
