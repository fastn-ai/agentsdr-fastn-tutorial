import "server-only";
import { createHmac } from "node:crypto";
import { after } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crmConversationMessages, crmEvents } from "@/lib/crm/schema";
import { companies, people } from "@/lib/leads/schema";
import { inOrg, runInOrganization } from "@/lib/tenancy/scope";
import { customerEventUrls, fastnConfigured, forgetCustomerTriggers } from "./client";

/**
 * Sends AgentSDR's sales moments to Fastn, where each organization's own
 * integrations (Slack, HubSpot, …) act on them:
 *
 *   lead.interested  a lead's CRM record moved to "interested" (AI or a person)
 *   lead.won         a lead's CRM record moved to "customer"
 *
 * Each integration an organization turns on in the widget (Slack, HubSpot, …)
 * has its own Fastn trigger and ingest URL; the event goes to every one that
 * listens for it, so a new app needs no change here. The body is signed with
 * HMAC-SHA256 (X-AgentSDR-Signature) and carries `organizationId`.
 *
 * CRM events are written inside the caller's transaction, so nothing is sent
 * until the row is visible outside it: a rolled-back move never leaves the
 * building. Sending runs after the response (next/server `after`, which
 * serverless hosts keep alive) and never throws into the CRM.
 */

type CrmEventRow = typeof crmEvents.$inferSelect;

const STAGE_EVENTS = new Set(["classification.auto_applied", "classification.changed", "stage.moved"]);
const TYPE_FOR_STAGE: Record<string, "lead.interested" | "lead.won"> = { interested: "lead.interested", customer: "lead.won" };

// How long to wait for the caller's transaction to commit before giving up.
const COMMIT_CHECKS_MS = [0, 500, 1_000, 2_000, 4_000];

function eventsEnabled(): boolean {
  return fastnConfigured() && Boolean(process.env.FASTN_EVENTS_SECRET && process.env.FASTN_PRODUCT_CONNECTOR_ID);
}

function categoryOf(data: unknown): string | null {
  const key = (data as { categoryKey?: unknown } | null)?.categoryKey;
  return typeof key === "string" ? key : null;
}

/** Called for every CRM event, inside its transaction. Cheap when nothing applies. */
export function forwardCrmEventAfterCommit(event: CrmEventRow): void {
  if (!eventsEnabled() || !STAGE_EVENTS.has(event.eventType)) return;
  const from = categoryOf(event.fromData);
  const to = categoryOf(event.toData);
  const type = to && to !== from ? TYPE_FOR_STAGE[to] : undefined;
  if (!type) return;
  const task = () => sendOnceCommitted(event, type);
  try {
    after(task);
  } catch {
    // Outside a request (a background job): its process stays up, so just run it.
    void task();
  }
}

async function sendOnceCommitted(event: CrmEventRow, type: "lead.interested" | "lead.won") {
  try {
    for (const wait of COMMIT_CHECKS_MS) {
      await new Promise((resolve) => setTimeout(resolve, wait));
      const body = await runInOrganization(event.organizationId, () => buildPayload(event, type));
      if (body === "not-committed") continue;
      if (body) await post(body);
      return;
    }
  } catch (error) {
    console.error(`[fastn] could not send ${type} for CRM event ${event.id}`, error);
  }
}

async function buildPayload(event: CrmEventRow, type: "lead.interested" | "lead.won") {
  const [committed] = await db
    .select({ id: crmEvents.id })
    .from(crmEvents)
    .where(and(inOrg(crmEvents), eq(crmEvents.id, event.id)))
    .limit(1);
  if (!committed) return "not-committed" as const;

  const [lead] = await db
    .select({
      id: people.id,
      firstName: people.firstName,
      lastName: people.lastName,
      fullName: people.fullName,
      email: people.email,
      title: people.title,
      linkedinUrl: people.linkedinUrl,
      companyName: companies.name,
      companyDomain: companies.domain,
    })
    .from(people)
    .leftJoin(companies, eq(companies.id, people.companyId))
    .where(and(inOrg(people), eq(people.id, event.personId)))
    .limit(1);
  if (!lead) return null;

  const [reply] = await db
    .select({
      id: crmConversationMessages.id,
      channel: crmConversationMessages.channel,
      text: crmConversationMessages.bodyText,
      receivedAt: crmConversationMessages.sentAt,
    })
    .from(crmConversationMessages)
    .where(
      // Messages hang off the person, already checked against this organization above.
      and(
        eq(crmConversationMessages.personId, lead.id),
        eq(crmConversationMessages.direction, "inbound"),
      ),
    )
    .orderBy(desc(crmConversationMessages.sentAt))
    .limit(1);

  // Why it moved: the AI's reasoning, or the note a person wrote when moving it.
  const meta = (event.meta ?? {}) as { reasoning?: unknown; note?: unknown; reason?: unknown };
  const reason = [meta.reasoning, meta.note, meta.reason].find((v): v is string => typeof v === "string" && v.trim() !== "") ?? null;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const name = lead.fullName ?? ([lead.firstName, lead.lastName].filter(Boolean).join(" ") || null);

  return {
    event: type,
    eventId: event.id,
    occurredAt: event.createdAt.toISOString(),
    organizationId: event.organizationId,
    channel: reply?.channel ?? null,
    lead: {
      id: lead.id,
      name,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      title: lead.title,
      company: lead.companyName ?? lead.companyDomain ?? null,
      linkedinUrl: lead.linkedinUrl ? `https://www.linkedin.com/in/${lead.linkedinUrl}` : null,
      crmUrl: appUrl && event.crmRecordId ? `${appUrl}/crm/records/${event.crmRecordId}` : null,
    },
    ...(type === "lead.interested"
      ? {
          reply: reply
            ? {
                id: reply.id,
                text: reply.text,
                reason,
                receivedAt: reply.receivedAt?.toISOString() ?? null,
                classification: "Interested",
              }
            : null,
        }
      : { wonAt: event.createdAt.toISOString() }),
  };
}

async function post(body: Record<string, unknown>) {
  const urls = await customerEventUrls(String(body.organizationId), String(body.event));
  // No integration listening for this event: the organization has not turned one on.
  if (!urls.length) {
    console.info(`[fastn] no integration listens for ${String(body.event)} in organization ${String(body.organizationId)}`);
    return;
  }
  const raw = JSON.stringify(body);
  const signature = createHmac("sha256", process.env.FASTN_EVENTS_SECRET!).update(raw).digest("hex");
  await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Fastn's firewall refuses requests without a normal user agent.
          "user-agent": "AgentSDR-Webhooks/1.0",
          "x-agentsdr-signature": `sha256=${signature}`,
        },
        body: raw,
        signal: AbortSignal.timeout(10_000),
      });
      // A customer who reinstalls gets a new URL: forget the old ones.
      if (res.status === 404) forgetCustomerTriggers(String(body.organizationId));
      if (!res.ok) {
        console.error(`[fastn] ${String(body.event)} for organization ${String(body.organizationId)} was refused (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
      }
    }),
  );
}
