import { AppIntegrationsFrame } from "@/components/settings/AppIntegrationsFrame";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { Callout } from "@/components/settings/SettingsKit";
import { can, requirePageOrgContext } from "@/lib/auth/context";
import { fastnConfigured } from "@/lib/fastn/client";

export const metadata = { title: "App integrations" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requirePageOrgContext();
  const canManage = can(ctx, { integrations: ["manage"] });
  return (
    <SettingsPage
      title="App integrations"
      description="Connect the tools your team already uses, such as your CRM and team chat, and choose what AgentSDR sends them."
    >
      {!canManage ? (
        <Callout tone="info">Only owners and admins can manage app integrations.</Callout>
      ) : !fastnConfigured() ? (
        <Callout tone="info" title="App integrations are not set up on this deployment">
          Whoever runs this AgentSDR deployment turns them on by setting FASTN_API_KEY and FASTN_IDV_SECRET. See
          FASTN_EMBED.md in the repository.
        </Callout>
      ) : (
        <AppIntegrationsFrame />
      )}
    </SettingsPage>
  );
}
