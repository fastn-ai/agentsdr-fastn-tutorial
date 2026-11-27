# Tutorial: AgentSDR + Fastn, step by step

From a fresh clone of AgentSDR to every customer having their own Slack and HubSpot integrations, with Claude building them. Every screenshot below is from the real run on production Fastn (`app.fastn.dev`) on 27 Nov 2026. Slack and HubSpot are the example; the same steps work with any of Fastn's 1,000+ connectors.

- Video walkthrough: https://youtu.be/Wq7qLsp0Llw
- How the embed works, and every environment variable: [FASTN_EMBED.md](FASTN_EMBED.md)
- Live demo: https://agentsdr-fastn-tutorial.vercel.app

**You need:** a GitHub account, a Vercel account, a Fastn account (created in Part 2), Claude (claude.ai), and a Slack workspace and HubSpot account to test as a customer.

## Part 1. Deploy AgentSDR

### Step 1. Put AgentSDR in your own repository

Clone [Kandid-ai/AgentSDR](https://github.com/Kandid-ai/AgentSDR) and push it unchanged to your own GitHub repository as `main`. The Fastn change goes on a separate branch, so `main` stays the original code.

![Step 1: Put AgentSDR in your own repository](docs/tutorial/step-01.jpg)

### Step 2. Deploy it on Vercel

Import the repository into Vercel. Pick the **Next.js** framework preset, or every route returns 404. Add a Postgres database; this tutorial uses Neon.

![Step 2: Deploy it on Vercel](docs/tutorial/step-02.jpg)

### Step 3. Set the environment variables

Set AgentSDR's own variables (`BETTER_AUTH_SECRET`, `INTEGRATION_CREDENTIALS_KEY`, `UNSUBSCRIBE_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`) and two that keep it stable on Vercel: `DB_POOL_MAX=20` and `INTERNAL_SCHEDULER=false`. The five `FASTN_*` variables are added in later steps.

![Step 3: Set the environment variables](docs/tutorial/step-03.jpg)

### Step 4. Seed the database and sign in

Seed the database: `bun run db:setup`, then `bun scripts/add-ai-campaign-caller.ts` and `bun scripts/create-crm-board-views.ts` (two tables `db:setup` misses today), then `bun run db:seed:demo`. Neon refuses the seed's `session_replication_role`, so seed a local Postgres and copy it over with `pg_dump -Fc` and `pg_restore --no-owner`. Sign in: this is AgentSDR running, with the demo organization **Northwind**.

![Step 4: Seed the database and sign in](docs/tutorial/step-04.jpg)

## Part 2. Sign up to Fastn

### Step 5. Create a Fastn account

Go to [app.fastn.dev](https://app.fastn.dev) and choose **Create account**. Enter your work email.

![Step 5: Create a Fastn account](docs/tutorial/step-05.jpg)

### Step 6. Add your name

Enter your first and last name, then **Create account**.

![Step 6: Add your name](docs/tutorial/step-06.jpg)

### Step 7. Verify your email

Fastn sends a sign-in link. Open it from your inbox.

![Step 7: Verify your email](docs/tutorial/step-07.jpg)

### Step 8. Sign in

The link opens a **Welcome to Fastn** page. Click **Sign in**. This extra click stops email scanners from using up the link.

![Step 8: Sign in](docs/tutorial/step-08.jpg)

### Step 9. Tell Fastn which product you are building

Onboarding starts with your product. If it guessed from your email domain, choose **Use a different domain**.

![Step 9: Tell Fastn which product you are building](docs/tutorial/step-09.jpg)

### Step 10. Enter your product's domain

Type your product's domain, here `agentsdr.ai`, and click **Read my site**.

![Step 10: Enter your product's domain](docs/tutorial/step-10.jpg)

### Step 11. Pick your role

Choose your role, for example **CTO or engineering lead**, and continue.

![Step 11: Pick your role](docs/tutorial/step-11.jpg)

### Step 12. Fastn reads your product

Fastn reads the website, docs and API, and lists what it found.

![Step 12: Fastn reads your product](docs/tutorial/step-12.jpg)

### Step 13. Check what Fastn found

Review the product summary. Correct anything that is wrong (here, the API docs URL), then continue.

![Step 13: Check what Fastn found](docs/tutorial/step-13.jpg)

### Step 14. Pick the apps your customers need

Select the apps your customers should be able to connect. Here: **HubSpot** and **Slack**. Any of Fastn's 1,000+ connectors can be added later.

![Step 14: Pick the apps your customers need](docs/tutorial/step-14.jpg)

### Step 15. Preview your widget

Fastn builds the integrations widget your customers will see inside your product.

![Step 15: Preview your widget](docs/tutorial/step-15.jpg)

### Step 16. Choose how to add the widget

Fastn shows the code to embed the widget. Pick **My AI tool** to have your coding assistant add it, or follow the instructions yourself.

![Step 16: Choose how to add the widget](docs/tutorial/step-16.jpg)

## Part 3. Embed Fastn in AgentSDR

### Step 17. Open API keys

In the Fastn dashboard, open **API keys** and click **Create key**.

![Step 17: Open API keys](docs/tutorial/step-17.jpg)

### Step 18. Create a live key with identity verification

Give the key the **Admin** role, let it reach **every customer**, and turn on **Verify caller identity (HMAC)** with **Enforce**. Copy the key and its identity secret; the secret is shown once. Store them in Vercel as `FASTN_API_KEY` and `FASTN_IDV_SECRET`. Never put them in the browser.

![Step 18: Create a live key with identity verification](docs/tutorial/step-18.jpg)

### Step 19. The code change

The pull request adds a settings page with the embedded widget, a token route, and signed lead events. These are the variables it reads.

![Step 19: The code change](docs/tutorial/step-19.jpg)

### Step 20. How AgentSDR finds each customer's triggers

`src/lib/fastn/client.ts` registers each AgentSDR organization as a Fastn customer, mints widget tokens, and finds that customer's own triggers, matched on `appTrigger.accountId`. It switches on any trigger that Fastn created switched off.

![Step 20: How AgentSDR finds each customer's triggers](docs/tutorial/step-20.jpg)

### Step 21. The widget inside AgentSDR

Deploy. Under **Settings → App integrations**, each AgentSDR organization now sees the Fastn widget with HubSpot and Slack.

![Step 21: The widget inside AgentSDR](docs/tutorial/step-21.jpg)

### Step 22. Onboarding sees the widget

Back in Fastn, onboarding marks **Set up the widget** and **Add the widget** as done once the widget loads in your product.

![Step 22: Onboarding sees the widget](docs/tutorial/step-22.jpg)

## Part 4. A customer connects their apps

### Step 23. A customer connects Slack

Signed in to AgentSDR as the customer (Northwind), click **Connect** on Slack. Fastn explains what will happen; click **Authorize**.

![Step 23: A customer connects Slack](docs/tutorial/step-23.jpg)

### Step 24. Approve Slack's permissions

Slack asks the customer to allow Fastn into their workspace. Click **Allow**.

![Step 24: Approve Slack's permissions](docs/tutorial/step-24.jpg)

### Step 25. Slack is connected

The Slack setup shows **Active** for this customer.

![Step 25: Slack is connected](docs/tutorial/step-25.jpg)

### Step 26. Connect HubSpot

Do the same for HubSpot: **Connect**, then **Authorize**.

![Step 26: Connect HubSpot](docs/tutorial/step-26.jpg)

### Step 27. Pick the HubSpot account

HubSpot asks which account to connect. Choose it and click **Choose Account**.

![Step 27: Pick the HubSpot account](docs/tutorial/step-27.jpg)

### Step 28. HubSpot is connected

The HubSpot setup shows **Active**. Each customer's connections belong to that customer only.

![Step 28: HubSpot is connected](docs/tutorial/step-28.jpg)

### Step 29. Your widget is live

Onboarding now shows **Your widget is live**: a customer turned an integration on. What is left is connecting AgentSDR itself and building the flows.

![Step 29: Your widget is live](docs/tutorial/step-29.jpg)

## Part 5. Build the integrations with Claude

### Step 30. AgentSDR is not in Fastn yet

Open **Connect AgentSDR**. Fastn has no connector for AgentSDR yet, and offers **Build in your AI tool**.

![Step 30: AgentSDR is not in Fastn yet](docs/tutorial/step-30.jpg)

### Step 31. Add Fastn to Claude

Click **Add to Claude**. It opens Claude's *Add custom connector* dialog with `https://mcp.fastn.dev/fastn-workspace` filled in. Click **Add**, then **Connect**, sign in to Fastn and click **Allow**.

![Step 31: Add Fastn to Claude](docs/tutorial/step-31.jpg)

### Step 32. Check which workspace Claude uses

In a new claude.ai chat, first ask which Fastn workspace and user Claude is connected to. It must name your workspace and email. If it names an old account, sign out at `connect.fastn.dev/auth/logout` and connect again.

![Step 32: Check which workspace Claude uses](docs/tutorial/step-32.jpg)

### Step 33. Give Claude the brief

Paste the brief from the guide: the two events (`lead.interested`, `lead.won`), their body, the signature header, and what Slack and HubSpot should do. Claude builds an AgentSDR connector with only those events and registers it as your product.

The brief used in this tutorial:

> Connect AgentSDR to fastn and build its Slack and HubSpot integrations end to end. AgentSDR has no outgoing webhooks, so our backend will POST two events to fastn, signed with the header `X-AgentSDR-Signature: sha256=<hex HMAC-SHA256 of the raw body>`. Event `lead.interested` fires when a lead is marked Interested; `lead.won` when a lead is marked Customer. Body: `{ event, eventId, occurredAt, organizationId, channel, lead: { name, firstName, lastName, email, title, company, linkedinUrl, crmUrl }, reply: { text, reason } }`; `lead.won` carries `wonAt` instead of `reply`. `organizationId` is our customer's id, the same id we register them with in fastn.
> (1) Build an AgentSDR connector with only these two events, no API actions and no-auth, and register it as my product.
> (2) Slack: on lead.interested, post the lead to the channel each customer picks in the widget, with name, company, email, title, channel, their reply, the reason and an Open in AgentSDR link.
> (3) HubSpot: on lead.interested, create or update the contact by email and add a note with the reply and reason; on lead.won, set the contact's lifecycle stage to customer.
> Rules: attach these to the widget our customers already use. Every run must use the customer's own connection, never a sandbox or test connection. Each customer's trigger must be on as soon as they install. Never print secrets in this chat. At the end, give me the connector id, its no-auth method id, and how my backend finds each customer's trigger URL.

![Step 33: Give Claude the brief](docs/tutorial/step-33.jpg)

### Step 34. Answer Claude's questions

Claude plans the flows and asks before building: which accounts to test with, who runs the integrations (each customer, with their own accounts), and whether to switch on existing installs.

![Step 34: Answer Claude's questions](docs/tutorial/step-34.jpg)

### Step 35. Approve the HubSpot mapping

Claude shows the field mapping from an AgentSDR lead to a HubSpot contact. Check it and click **Looks good, turn on**.

![Step 35: Approve the HubSpot mapping](docs/tutorial/step-35.jpg)

### Step 36. Approve the test cases

Claude writes the test cases: signatures, routing, the Slack message, HubSpot create and update, and install behaviour. Review them and click **Approve**.

![Step 36: Approve the test cases](docs/tutorial/step-36.jpg)

### Step 37. Read Claude's results

Claude runs the tests against the customer's real Slack and HubSpot, cleans up, and reports what passed and what failed on Fastn's side, with ticket numbers.

![Step 37: Read Claude's results](docs/tutorial/step-37.jpg)

### Step 38. AgentSDR is now your product connector

In Fastn, **Connect your product** lists the AgentSDR connector. Copy its id and its no-auth method id into Vercel as `FASTN_PRODUCT_CONNECTOR_ID` and `FASTN_PRODUCT_AUTH_METHOD_ID`.

![Step 38: AgentSDR is now your product connector](docs/tutorial/step-38.jpg)

### Step 39. The two workflows

**Integrations → Workflows** shows the two flows Claude published: lead to HubSpot contact, and interested lead to Slack.

![Step 39: The two workflows](docs/tutorial/step-39.jpg)

### Step 40. Set the signing secret

Make one new random secret and put the same value in three places: Vercel `FASTN_EVENTS_SECRET`, Fastn **Settings → Secrets**, and the AgentSDR connector's **Webhook config → Signing Secret**. Fastn never shows a stored secret again, so set a fresh value everywhere. Redeploy.

![Step 40: Set the signing secret](docs/tutorial/step-40.jpg)

## Part 6. Run a real lead

### Step 41. Move a lead to Interested

In AgentSDR's **Funnel**, open a lead's stage menu and move it into an Interested stage, such as Information Requested.

![Step 41: Move a lead to Interested](docs/tutorial/step-41.jpg)

### Step 42. Confirm the move

AgentSDR asks what should happen next. Pick an option and **Apply**. AgentSDR sends a signed `lead.interested` event to this customer's triggers.

![Step 42: Confirm the move](docs/tutorial/step-42.jpg)

### Step 43. The lead appears in Slack

Seconds later the lead is posted in the customer's Slack channel, with their reply and an **Open in AgentSDR** button.

![Step 43: The lead appears in Slack](docs/tutorial/step-43.jpg)

### Step 44. HubSpot contact and note

In the customer's HubSpot, the contact is created or updated by email, with a note from Fastn.

![Step 44: HubSpot contact and note](docs/tutorial/step-44.jpg)

### Step 45. Move a lead to Customer

Move a lead to **Customer** in AgentSDR. Fastn receives `lead.won` and sets the HubSpot lifecycle stage to **Customer**.

![Step 45: Move a lead to Customer](docs/tutorial/step-45.jpg)

### Step 46. Watch your customers

**Customers** in Fastn lists each AgentSDR organization, with its connections and status.

![Step 46: Watch your customers](docs/tutorial/step-46.jpg)

## Part 7. Customers change their own integration

### Step 47. Customers can ask Fastn's agent

With building enabled for your workspace, customers can open Fastn's agent from the sparkle button in the widget and describe a change in plain words.

![Step 47: Customers can ask Fastn's agent](docs/tutorial/step-47.jpg)

### Step 48. The agent makes the customer their own copy

The agent never changes your integration for everyone. It makes the customer their own copy and changes that. Known issue (reported 27 Nov 2026): in our test the copy lost its Slack trigger, so check the customer's Slack still receives a lead after any change.

![Step 48: The agent makes the customer their own copy](docs/tutorial/step-48.jpg)

### Step 49. Done

All seven onboarding steps are done. Every AgentSDR customer can now connect their own apps, and lead events reach them within seconds.

![Step 49: Done](docs/tutorial/step-49.jpg)

## If something does not work

- **Claude builds in the wrong workspace.** Ask it which workspace it is in before every build. Sign out at `https://connect.fastn.dev/auth/logout` if it names an old account, and disconnect any computer linked to claude.ai whose local Fastn connection points elsewhere.
- **Moving a lead does nothing in Slack.** AgentSDR logs `[fastn] no integration listens for …` when it finds no trigger for that customer. Check the customer connected the app in the widget, and that triggers are matched on `appTrigger.accountId` (Fastn returns `endOrgId` empty).
- **Fastn answers 401.** The signing secret differs between Vercel, Fastn Secrets and the connector's webhook config. Set one new value in all three and redeploy.
- **Moving a lead hangs.** Set `DB_POOL_MAX=20` and `INTERNAL_SCHEDULER=false` on Vercel.
- **The Funnel page says "CRM configuration request failed".** Run `bun scripts/create-crm-board-views.ts` against the database.
- **Reason is empty in Slack.** For leads moved by hand, AgentSDR does not always save the note typed in the move dialog. Leads the AI classifies carry its reasoning.

## Lessons from this run

- Ask Claude which workspace it is in before every build.
- Keep secrets out of chats and recordings; set them straight into Vercel and Fastn.
- `db:setup` alone is not enough for today's AgentSDR; run the two extra scripts.
- Verify each step against the real result (the Slack message and the HubSpot record), not only the test report.
