"use client";

import { SettingsSubPage } from "@/components/settings/sub-page";
import { AppContent } from "@/components/settings/app-content";

export default function Page() {
  return <SettingsSubPage title="App">{() => <AppContent />}</SettingsSubPage>;
}
