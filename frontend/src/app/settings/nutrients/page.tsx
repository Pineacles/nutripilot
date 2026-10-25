"use client";

import { SettingsSubPage } from "@/components/settings/sub-page";
import { NutrientsContent } from "@/components/settings/nutrients-content";

export default function Page() {
  return <SettingsSubPage title="Nutrients and targets">{() => <NutrientsContent />}</SettingsSubPage>;
}
