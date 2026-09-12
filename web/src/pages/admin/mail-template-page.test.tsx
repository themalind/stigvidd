// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MailTemplatePage from "./mail-template-page";
import type { MailTemplate } from "@/types/types";

const api = vi.hoisted(() => ({
  getMailTemplate: vi.fn(),
  updateMailTemplate: vi.fn(),
  previewMailTemplate: vi.fn(),
}));
vi.mock("@/api/mail-templates", () => api);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toasts }));

vi.mock("react-router", () => ({
  useParams: () => ({ identifier: "tpl-1" }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

// The seeded verify-email row, which is the one with a production caller.
function template(overrides: Partial<MailTemplate> = {}): MailTemplate {
  return {
    identifier: "tpl-1",
    key: "verify-email",
    language: "sv",
    subject: "Bekräfta din e-postadress",
    bodyHtml:
      '<p>Hej {{NickName}},</p>\n<p><a href="{{VerificationUrl}}">Bekräfta</a></p>\n<p>{{VerificationCode}}</p>',
    bodyText: "Hej {{NickName}}, {{VerificationUrl}} {{VerificationCode}}",
    description: "Skickas vid registrering.",
    lastUpdatedAt: "2026-09-12T00:00:00Z",
    purpose: "Sent the moment somebody registers.",
    isKnown: true,
    tokens: [
      { name: "NickName", label: "Nickname", description: "Their name.", sampleValue: "Ralf", isUsed: true },
      { name: "VerificationUrl", label: "Verification link", description: "The link.", sampleValue: "https://x.test", isUsed: true },
      { name: "VerificationCode", label: "Verification code", description: "The code.", sampleValue: "402913", isUsed: true },
    ],
    unknownTokens: [],
    missingTokens: [],
    ...overrides,
  };
}

const saveButton = () => screen.getByRole("button", { name: /Save changes|Saving/ });

// The HTML body starts in the visual editor, which cannot be typed into under jsdom -- it
// does not implement editing at all. Everything that needs to change the body goes through
// the source view instead, which is a plain textarea and is the escape hatch a real operator
// has for exactly the same reason.
async function typeIntoSource(html: string) {
  await userEvent.click(screen.getByRole("tab", { name: "HTML source" }));
  const source = screen.getByLabelText("HTML source code");
  await userEvent.clear(source);
  // PASTE, not type: userEvent reads "{{" as its escape for a literal brace, so typing a
  // placeholder produces something that is not a placeholder at all -- and every assertion
  // about unknown tokens then passes or fails for the wrong reason.
  // docs/notes/userevent-type-eats-double-braces.md
  await userEvent.click(source);
  await userEvent.paste(html);
  return source;
}

/** Matches a message whose text is split across elements by an interpolated expression. */
function messageStartingWith(prefix: string) {
  return (_: string, element: Element | null) =>
    element?.tagName === "P" && (element.textContent ?? "").startsWith(prefix);
}

beforeEach(() => {
  api.getMailTemplate.mockResolvedValue(template());
  api.updateMailTemplate.mockImplementation((_id: string, request: unknown) =>
    Promise.resolve({ ...template(), ...(request as object) }),
  );
  api.previewMailTemplate.mockResolvedValue({
    subject: "Bekräfta din e-postadress",
    bodyHtml: "<p>Hej Ralf</p>",
    bodyText: "Hej Ralf",
  });
});

/**
 * The rule the whole page is built around. No schema-based editor reproduces a stored mail
 * body byte for byte, so if "has this changed" were decided by comparing strings it would be
 * true from the moment the page loaded — and simply opening every template in turn would
 * rewrite every one of them, replacing copy nobody asked to change.
 */
describe("the guard against rewriting a template nobody edited", () => {
  it("cannot be saved until something is actually edited", async () => {
    render(<MailTemplatePage />);

    await screen.findByDisplayValue("Bekräfta din e-postadress");

    expect(saveButton()).toBeDisabled();
    expect(api.updateMailTemplate).not.toHaveBeenCalled();
  });

  it("stays unsaveable even after the visual editor has loaded and normalised the body", async () => {
    // Loading the body into the editor re-serialises it (the stored newlines go, the CSSOM
    // rewrites style values). None of that is an edit, and none of it may enable the button.
    render(<MailTemplatePage />);

    await screen.findByDisplayValue("Bekräfta din e-postadress");
    await waitFor(() => expect(document.querySelector(".ProseMirror")).not.toBeNull());

    expect(saveButton()).toBeDisabled();
  });

  it("is still unsaveable after merely looking at the HTML source and coming back", async () => {
    // Reseeding the visual editor on the way back is a load, not an edit. If that seeding
    // announced itself as a change, an operator who only wanted to READ the markup would
    // leave the template dirty, and the next click of Save would write a body they never
    // touched.
    render(<MailTemplatePage />);
    await screen.findByDisplayValue("Bekräfta din e-postadress");

    await userEvent.click(screen.getByRole("tab", { name: "HTML source" }));
    await userEvent.click(screen.getByRole("tab", { name: "Visual" }));

    expect(saveButton()).toBeDisabled();
  });

  it("keeps an edit made in the source view when switching to the visual one", async () => {
    render(<MailTemplatePage />);
    await screen.findByDisplayValue("Bekräfta din e-postadress");

    await typeIntoSource("<p>Hej {{NickName}}, nytt innehåll</p>");
    await userEvent.click(screen.getByRole("tab", { name: "Visual" }));

    // The visual editor really has to be reseeded from the edit, not merely left showing what
    // it was constructed with -- otherwise a switch back to source would silently restore the
    // old body over the operator's work.
    await waitFor(() =>
      expect(document.querySelector(".ProseMirror")?.textContent).toContain("nytt innehåll"),
    );

    await userEvent.click(screen.getByRole("tab", { name: "HTML source" }));

    expect((screen.getByLabelText("HTML source code") as HTMLTextAreaElement).value).toContain(
      "nytt innehåll",
    );
  });

  it("becomes saveable once the operator changes something", async () => {
    render(<MailTemplatePage />);

    await userEvent.type(await screen.findByLabelText("Subject"), "!");

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it("sends exactly what is on screen", async () => {
    render(<MailTemplatePage />);

    await userEvent.type(await screen.findByLabelText("Subject"), "!");
    await userEvent.click(saveButton());

    await waitFor(() => expect(api.updateMailTemplate).toHaveBeenCalledOnce());

    expect(api.updateMailTemplate).toHaveBeenCalledWith("tpl-1", {
      subject: "Bekräfta din e-postadress!",
      bodyHtml: expect.stringContaining("{{VerificationUrl}}"),
      bodyText: expect.stringContaining("{{NickName}}"),
      description: "Skickas vid registrering.",
    });
  });
});

/**
 * The two ways to break mail are not symmetric, and the page must not treat them as if they
 * were. Both are measured in MailTemplateRendererTests on the backend.
 */
describe("placeholder guard rails", () => {
  it("refuses to save a placeholder this template does not supply, and names it", async () => {
    render(<MailTemplatePage />);
    await screen.findByDisplayValue("Bekräfta din e-postadress");

    await typeIntoSource("<p>Hej {{NickNmae}}</p>");

    // The palette says it too, so this is the page's own save-gate message specifically.
    const blockedMessage = await screen.findByText(messageStartingWith("Saving is blocked:"));

    expect(blockedMessage.textContent).toContain("{{NickNmae}}");
    expect(saveButton()).toBeDisabled();
  });

  it("shows an unrecognised placeholder in the palette with the consequence spelled out", async () => {
    render(<MailTemplatePage />);
    await screen.findByDisplayValue("Bekräfta din e-postadress");

    await typeIntoSource("<p>{{Nonsense}}</p>");

    expect(await screen.findByText("Not recognised")).toBeInTheDocument();
    expect(screen.getByText(/fails to render, so it is never sent/)).toBeInTheDocument();
  });

  it("allows a dropped placeholder but warns what the mail will no longer contain", async () => {
    // This renders perfectly well — the renderer ignores a model key the copy does not use.
    // It just mails somebody a verification with no way to verify, which is the operator's
    // call to make and not the page's to refuse.
    render(<MailTemplatePage />);
    await screen.findByDisplayValue("Bekräfta din e-postadress");

    // Both bodies: a placeholder still present in the plain-text half is still going out, so
    // removing it from the HTML alone is correctly NOT a missing placeholder.
    await typeIntoSource("<p>Hej {{NickName}} {{VerificationCode}}</p>");

    await userEvent.click(screen.getByRole("tab", { name: "Plain text" }));
    const textBody = screen.getByLabelText("Plain-text version");
    await userEvent.clear(textBody);
    await userEvent.click(textBody);
    await userEvent.paste("Hej {{NickName}} {{VerificationCode}}");

    const warning = await screen.findByText(
      (_, element) =>
        element?.getAttribute("data-slot") === "card-title" &&
        (element.textContent ?? "").includes("This mail will not contain"),
    );

    expect(warning.textContent).toContain("{{VerificationUrl}}");
    expect(saveButton()).toBeEnabled();
  });
});

describe("the preview", () => {
  it("renders the draft through the API rather than guessing locally", async () => {
    render(<MailTemplatePage />);

    await userEvent.click(await screen.findByRole("button", { name: /Preview/ }));

    await waitFor(() => expect(api.previewMailTemplate).toHaveBeenCalledOnce());

    expect(await screen.findByTitle("Mail preview")).toBeInTheDocument();
  });

  it("surfaces the server's refusal instead of showing a stale preview", async () => {
    api.previewMailTemplate.mockRejectedValue(
      new Error("The mail template uses the placeholder '{{Nope}}' but the model has no value for it."),
    );

    render(<MailTemplatePage />);

    await userEvent.click(await screen.findByRole("button", { name: /Preview/ }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalled());
    expect(screen.queryByTitle("Mail preview")).not.toBeInTheDocument();
  });
});

describe("the plain-text body", () => {
  it("is only rewritten from the HTML when the operator asks", async () => {
    // BodyText is required and may well have been hand-tuned. Regenerating it on save would
    // throw that away without anybody choosing to.
    render(<MailTemplatePage />);

    await userEvent.click(await screen.findByRole("tab", { name: "Plain text" }));

    const before = (screen.getByLabelText("Plain-text version") as HTMLTextAreaElement).value;
    expect(before).toContain("{{VerificationUrl}}");

    await userEvent.click(screen.getByRole("button", { name: /Generate from HTML/ }));

    expect((screen.getByLabelText("Plain-text version") as HTMLTextAreaElement).value).not.toBe(
      before,
    );
  });
});

describe("a template no code sends", () => {
  it("says so, and does not condemn the placeholders it happens to use", async () => {
    api.getMailTemplate.mockResolvedValue(
      template({ key: "orphan", purpose: null, isKnown: false, tokens: [], missingTokens: [] }),
    );

    render(<MailTemplatePage />);

    expect(await screen.findByText(/No code declares this template key/)).toBeInTheDocument();
    expect(screen.queryByText(/Saving is blocked/)).not.toBeInTheDocument();
  });
});

describe("when the template cannot be loaded", () => {
  it("offers no editor at all rather than a blank form over live copy", async () => {
    // The trail editor once shipped a live Save button over a blank form after a failed
    // load; one click overwrote the record. Not repeating that here.
    api.getMailTemplate.mockRejectedValue(new Error("nope"));

    render(<MailTemplatePage />);

    expect(await screen.findByText("Template not available")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save changes/ })).not.toBeInTheDocument();
  });
});
