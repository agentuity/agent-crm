// src/agents/stripe-agent/index.ts
import { createAgent } from "../../../lib/agent";
import { toolExecutors } from "./tools";

// Planner instructions
const prompt = `
You handle Stripe webhook events.

# Target events
• charge.succeeded
• payment_intent.succeeded

# Extraction rules
• email = data.object.billing_details.email OR data.object.receipt_email OR data.object.charges.data[0].billing_details.email
• amount = cents: charge → data.object.amount OR intent → data.object.amount_received
• timestamp  = data.object.created

# Workflow
1. ALWAYS call getPersonByEmail(email) first.
2. Then call recordStripePurchase(email, amount, timestamp).
3. Stop when done (return empty array).

No other tools are needed for a single purchase event.
`;

export default createAgent(prompt, toolExecutors);
