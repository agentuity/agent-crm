# CRM Agent

<div align="center">
    <img src="https://raw.githubusercontent.com/agentuity/cli/refs/heads/main/.github/Agentuity.png" alt="Agentuity" width="100"/> <br/>
    <strong>Build Agents, Not Infrastructure</strong> <br/>
    <br/>
        <a target="_blank" href="https://app.agentuity.com/deploy" alt="Agentuity">
            <img src="https://app.agentuity.com/img/deploy.svg" /> 
        </a>
    <br />
</div>

A collection of three serverless agents built with Agentuity, Composio and custom tools to synchronize data between Clerk, SmartLead and Stripe webhooks and your Attio CRM instance.

## Introduction

This repository contains three webhook‑driven agents:

- Clerk Agent: syncs new users and org updates from Clerk into Attio.
- SmartLead Agent: tracks lead category changes and email replies from SmartLead into Attio.
- Stripe Agent: listens for `charge.succeeded` events and updates a company’s credit balance in Attio.  
  All agents use the shared createAgent template in src/lib/agent.ts, Composio toolkits for Attio operations, and custom executors where needed.

## Installation

1. Clone the repo:
   ```
   git clone https://github.com/your-org/attio-crm-agents.git
   cd attio-crm-agents
   ```
2. Install dependencies:
   ```
   npm install
   ```

## Configuration

1. Copy the example env file:
   ```
   cp .env.example .env
   ```
2. Open .env and set:
   ```
    COMPOSIO_API_KEY=your_composio_api_key
    STRIPE_API_KEY=sk_live_…
    STRIPE_SIGNING_SECRET=whsec_…
    SMARTLEAD_API_KEY=your_smartlead_api_key
   ```

## Project Structure

    .
    ├── src
    │   ├── agents
    │      ├── clerk-agent
    │      ├── smartlead-agent
    │      └── stripe-agent
    └── lib
    │   └── agent.ts          # Shared createAgent template
    ├── .env.example
    ├── package.json
    └── README.md

## Agents

### Clerk Agent

- File: `src/agents/clerkAgent.ts`
- Purpose:
  1. On user.created: find or create a Person in Attio, then find or create their Company.
  2. On organization.created/updated: find existing company and update its org_id and/or name per rules.

### SmartLead Agent

- File: `src/agents/smartlead-agent/index.ts`
- Purpose:
  1. On `LEAD_CATEGORY_UPDATED`:
     - find or create Person and Company, then create a Deal.
     - Add them to the positive_leads KV.
  2. On `EMAIL_REPLY`:
     - check if the email is in the archive KV.
     - If the email is in the archive, ping the relevant person in Slack.
     - If the email is not in the archive, store the email in the emails KV.

#### Email Handler Agent

- File: `src/agents/email-handler-agent/index.ts`
- Purpose:
  1. Once a day:
     - Go through positive_leads KV and pull the associated emails from the emails KV.
     - If the email is simple, send an auto-reply.
     - If the email is complex, ping the relevant person in Slack.
     - Add the email to the archive KV.
     - Clear the positive_leads KV.

### Stripe Agent

- File: `src/agents/stripeAgent.ts`
- Purpose:
  1. Verify `charge.succeeded` webhooks.
  2. Use getOrgIdFromCustomer, `ATTIO_FIND_RECORD`, `latestAttioNumber`, `ATTIO_UPDATE_RECORD` to update credits.
- Features: missing credits default to zero, judge loop to enforce single-tool usage.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Bun**: Version 1.2.4 or higher

## 🚀 Getting Started

### Authentication

Before using Agentuity, you need to authenticate:

```bash
agentuity login
```

This command will open a browser window where you can log in to your Agentuity account.

### Creating a New Agent

To create a new agent in your project:

```bash
agentuity agent new
```

Follow the interactive prompts to configure your agent.

### Development Mode

Run your project in development mode with:

```bash
agentuity dev
```

This will start your project and open a new browser window connecting your agent to the Agentuity Console in DevMode, allowing you to test and debug your agent in real-time.

## 🌐 Deployment

When you're ready to deploy your agent to the Agentuity Cloud:

```bash
agentuity deploy
```

This command will bundle your agent and deploy it to the cloud, making it accessible via the Agentuity platform.

## 📚 Project Structure

```
├── agents/             # Agent definitions and implementations
├── node_modules/       # Dependencies
├── package.json        # Project dependencies and scripts
└── agentuity.yaml      # Agentuity project configuration
```

## 🔧 Configuration

Your project configuration is stored in `agentuity.yaml`. This file defines your agents, development settings, and deployment configuration.

## 🛠️ Advanced Usage

### Environment Variables

You can set environment variables for your project:

```bash
agentuity env set KEY VALUE
```

### Secrets Management

For sensitive information, use secrets:

```bash
agentuity env set --secret KEY VALUE
```

## 📖 Documentation

For comprehensive documentation on the Agentuity JavaScript SDK, visit:
[https://agentuity.dev/SDKs/javascript](https://agentuity.dev/SDKs/javascript)

## 🆘 Troubleshooting

If you encounter any issues:

1. Check the [documentation](https://agentuity.dev/SDKs/javascript)
2. Join our [Discord community](https://discord.gg/agentuity) for support
3. Contact the Agentuity support team

## 📝 License

This project is licensed under the terms specified in the LICENSE file.
