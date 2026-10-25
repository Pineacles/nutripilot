"use client";

import { SettingsSubPage } from "@/components/settings/sub-page";
import { SupplementsSection } from "@/components/settings/supplements-section";

export default function Page() {
  return <SettingsSubPage title="Supplements">{(s) => <SupplementsSection supplements={s.supplement_definitions ?? []} />}</SettingsSubPage>;
}
