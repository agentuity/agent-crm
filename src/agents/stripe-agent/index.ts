import { createAgent } from "../../../lib/agent";
import { toolExecutors, toolMetadataList } from "./tools";   //  ⬅️  import both

const prompt = `
You handle Stripe webhook events.

# Target events
• charge.succeeded
• payment_intent.succeeded

# Extraction rules
• email = data.object.billing_details.email or data.object.receipt_email or data.object.charges.data[0].billing_details.email
• amount = cents (charge → data.object.amount, intent → data.object.amount_received)
• timestamp = data.object.created

# Workflow
1. ALWAYS call getPersonByEmail(email) first.
2. Then call recordStripePurchase(email, amount, timestamp).
3. Stop when done (return empty array).

# Available tools (JSON schema bundle the LLM will reason over)
${JSON.stringify(toolMetadataList, null, 2)}
`;

export default createAgent(prompt, toolExecutors);
