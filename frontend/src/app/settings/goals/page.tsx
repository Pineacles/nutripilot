"use client";

import { SettingsSubPage } from "@/components/settings/sub-page";
import { GoalsContent } from "@/components/settings/goals-content";

export default function Page() {
  return <SettingsSubPage title="Goals">{() => <GoalsContent />}</SettingsSubPage>;
}
