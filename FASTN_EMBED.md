# AgentSDR with Fastn embedded

This repository is [AgentSDR](https://github.com/Kandid-ai/AgentSDR), the open-source AI SDR (MIT), with [Fastn](https://fastn.ai) embedded in it. It shows how an existing SaaS product gives every one of its customers integrations (Slack, HubSpot and any other app) without building those integrations itself.

Live demo: **https://agentsdr-fastn-tutorial.vercel.app** (sign-in is for the Fastn team; run it yourself with the steps below). Step-by-step guide: [TUTORIAL.md](TUTORIAL.md).

## What the embed does

- **Settings → App integrations** shows Fastn's integrations widget. Each AgentSDR organization is its own Fastn customer: it connects its own Slack and HubSpot, and picks its own settings, such as the Slack channel.
- **AgentSDR sends events, Fastn does the integration.** When a lead turns *Interested* or becomes a *Customer*, AgentSDR sends `lead.interested` or `lead.won` to Fastn. The workflows behind the widget (post to Slack, update HubSpot, …) run on that customer's own connections.
- **Embed once, any app.** AgentSDR has no code for Slack or HubSpot. When a customer turns on another app in the widget, its trigger is found and the event is sent there too, with no change to AgentSDR.

## The code

Everything Fastn-related is in a few commits on top of upstream AgentSDR (`git log --oneline a7fdd26..HEAD`).

| File | What it does |
|---|---|
| `src/lib/fastn/client.ts` | Signs every call to Fastn (API key + identity HMAC), registers each organization as a Fastn customer, connects it to AgentSDR's own Fastn connector, mints widget tokens, and finds the customer's triggers for an event. |
| `src/app/api/settings/fastn/token/route.ts` | `POST /api/settings/fastn/token`: the widget URL for the signed-in organization. Owners and admins only. The key never reaches the browser. |
| `src/app/settings/app-integrations/page.tsx`, `src/components/settings/AppIntegrationsFrame.tsx` | The settings page and the iframe. |
| `src/lib/fastn/events.ts` | Sends `lead.interested` / `lead.won`, signed with HMAC-SHA256, once the CRM change has committed. Hooked into `appendCrmEvent` in `src/lib/crm/events.ts`. |

### Identity signing

The live API key Fastn's onboarding creates requires signed identity headers on every call:

```
x-org-id:        <the customer's id; AgentSDR uses its organization id>
x-user-id:       <the person acting>
x-identity-hmac: hex HMAC-SHA256 of "<x-org-id>\n<x-user-id>" with the key's identity secret
```

Calls made as AgentSDR itself (registering a customer, looking up a customer's triggers) leave out `x-org-id` and sign an empty org id. `client.ts` does this in one place.

### Events

Each integration a customer turns on has its own Fastn trigger and ingest URL. To send an event, AgentSDR lists the customer's triggers on the AgentSDR connector (`GET /api/v1/app-triggers?connectorId=…&org_id=<organizationId>&include_instances=true`, cached for a minute). It keeps the ones installed by that customer (`installationId` set and `appTrigger.accountId` equal to the organization id; `endOrgId` is Fastn's own id and comes back empty here) that listen for the event, switches on any Fastn created switched off (`PATCH /api/v1/triggers/{id}/status`), and posts to each:

```
POST <trigger webhookUrl>
X-AgentSDR-Signature: sha256=<hex HMAC-SHA256 of the raw body, with the connector's signing secret>

{ "event": "lead.interested", "eventId": "…", "occurredAt": "…", "organizationId": "<AgentSDR organization id>",
  "channel": "email", "lead": { "name", "firstName", "lastName", "email", "title", "company", "linkedinUrl", "crmUrl" },
  "reply": { "id", "text", "reason", "receivedAt", "classification" } }
```

`lead.won` carries `wonAt` instead of `reply`. A customer with no integration listening for the event is skipped, with a `[fastn] no integration listens…` log line. The request sets a normal `User-Agent`; Fastn's firewall refuses requests without one.

`reply.reason` is the AI's reasoning when it classified the reply. A note typed while moving a lead by hand is not always saved by AgentSDR, so for manual moves it can be empty.

## Run it yourself

1. **AgentSDR locally**: follow upstream's `docs/development.md` (Bun 1.2+, PostgreSQL 16+). Seed the demo organization with `bun run db:setup`, then `bun scripts/add-ai-campaign-caller.ts` and `bun scripts/create-crm-board-views.ts` (two tables `db:setup` misses today), then `bun run db:seed:demo`. The seed needs `BETTER_AUTH_URL` set and the same `INTEGRATION_CREDENTIALS_KEY` the app will run with.
2. **A Fastn account**: sign up at [app.fastn.dev](https://app.fastn.dev) and go through onboarding with your product's domain. In *Add the widget*, create the live API key: copy the key and its identity secret (shown once).
3. **AgentSDR in Fastn**: in onboarding's *Build an integration* step, use *Build in your AI tool*. With Fastn's MCP connected to Claude, ask it to add an AgentSDR connector with the two events (`lead.interested`, `lead.won`, routed by `organizationId`, signed with `X-AgentSDR-Signature`), and to build the Slack and HubSpot workflows on your existing widgets. Note the connector id, its no-auth method id and the signing secret.
4. **`.env.local`**:

   | Variable | Value |
   |---|---|
   | `FASTN_API_KEY` | the live key from step 2 |
   | `FASTN_IDV_SECRET` | its identity secret |
   | `FASTN_EVENTS_SECRET` | the AgentSDR connector's signing secret |
   | `FASTN_PRODUCT_CONNECTOR_ID` | the AgentSDR connector id |
   | `FASTN_PRODUCT_AUTH_METHOD_ID` | its no-auth method id |
   | `FASTN_BASE_URL` | leave unset for production (`https://api.fastn.dev`) |

5. Open **Settings → App integrations**, connect Slack, pick a channel, then mark a lead *Interested* in its CRM record. The lead appears in that Slack channel.

## Deploying

The demo runs on Vercel with a Neon Postgres. Set the variables above plus AgentSDR's own (`BETTER_AUTH_SECRET`, `INTEGRATION_CREDENTIALS_KEY`, `UNSUBSCRIBE_SECRET`, `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`). Two notes:

- Pick the **Next.js** framework preset for the Vercel project, or every route returns 404.
- AgentSDR's demo seed sets `session_replication_role`, which Neon does not allow. Seed a local database and restore it with `pg_dump -Fc` / `pg_restore --no-owner`.
- Set `DB_POOL_MAX` to 20 or more. At 5, moving a lead's stage can hang behind a transaction waiting for a free connection.

AgentSDR's background jobs (mail sync, sequences) need a long-running server, so on serverless hosts they do not run. The Fastn events do, because they are sent with `next/server`'s `after()`.
