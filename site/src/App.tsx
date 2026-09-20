// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import FaqSection from "@/components/faq-section";
import FeaturesSection from "@/components/features-section";
import HeroSection from "@/components/hero-section";
import InstallSection from "@/components/install-section";
import ScreenshotsSection from "@/components/screenshots-section";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

export default function App() {
  return (
    <div className="min-h-svh bg-bg text-text">
      <a
        href="#innehall"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-base focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-contrast"
      >
        Hoppa till innehållet
      </a>
      <SiteHeader />
      <main id="innehall">
        <HeroSection />
        <FeaturesSection />
        <ScreenshotsSection />
        <InstallSection />
        <FaqSection />
      </main>
      <SiteFooter />
    </div>
  );
}
