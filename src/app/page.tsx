"use client";

import { AppHeader } from "@/components/layout/AppHeader";
import { HeroSection } from "@/components/home/HeroSection";
import { FeatureGrid } from "@/components/home/FeatureGrid";
import { ProjectCarousel } from "@/components/home/ProjectCarousel";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-6">
        <HeroSection />
        <FeatureGrid />
        <ProjectCarousel />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-center px-6 text-sm text-slate-500 dark:text-slate-400">
          Happy SourceCode — 让源码学习充满生命力
        </div>
      </footer>
    </div>
  );
}
