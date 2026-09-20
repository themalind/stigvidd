// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ChevronDown } from "lucide-react";
import { faq, sources } from "@/content/site-content";

export default function FaqSection() {
  return (
    <section id="fragor" className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Vanliga frågor</h2>

      {/* <details> rather than a JS accordion: it opens without React, it is keyboard
          accessible for free, and browser find-in-page reaches the closed answers. */}
      <div className="mt-8 divide-y divide-border border-y border-border">
        {faq.map((item) => (
          <details key={item.question} className="group py-4">
            <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium marker:content-['']">
              {item.question}
              <ChevronDown
                aria-hidden="true"
                className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{item.answer}</p>
          </details>
        ))}
      </div>

      <div className="mt-12 rounded-base border border-border bg-surface p-6">
        <h3 className="font-semibold">{sources.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{sources.body}</p>
      </div>
    </section>
  );
}
