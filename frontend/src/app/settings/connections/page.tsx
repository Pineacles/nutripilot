"use client";

import { SettingsSubPage } from "@/components/settings/sub-page";
import { ConnectionsContent } from "@/components/settings/connections-content";

export default function Page() {
  return <SettingsSubPage title="Connections">{(s) => <ConnectionsContent settings={s} />}</SettingsSubPage>;
}
