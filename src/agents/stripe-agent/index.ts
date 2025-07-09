// src/agents/stripe-agent/index.ts
import { createAgent } from "../../../lib/agent";
import { toolExecutors, toolMetadataList } from "./tools";

// High-level instructions only – no huge JSON bundle
const prompt = `
You handle Stripe purchase-related webhook events.

Target events
• charge.succeeded
• payment_intent.succeeded

Extraction rules
• email      = billing_details.email
               or receipt_email
               or charges.data[0].billing_details.email
• amount     = data.object.amount (cents)            // charge
               or data.object.amount_received (cents) // intent
• timestamp  = data.object.created                   // Unix seconds

Workflow
1. ALWAYS call getPersonByEmail(email) first.
2. Then call recordStripePurchase(email, amount, timestamp).
3. Return [] when finished.
`;

export default createAgent(
  prompt,
  toolMetadataList,   // 2️⃣  metadata for the planner-LLM
  toolExecutors       // 3️⃣  runtime executors map
);
