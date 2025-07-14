import type { AgentRequest, AgentResponse, AgentContext } from "@agentuity/sdk";
import { createAgent } from "../../../lib/agent";
import { toolExecutors, toolMetadataList } from "./tools";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_API_KEY ?? "", { apiVersion: "2025-06-30.basil" });


const prompt = `
You are an automated backend agent that handles **Stripe \`charge.succeeded\`**
webhooks.  When a charge is confirmed, you must log the purchase in Attio so
the company’s credit balance is kept up-to-date.

DATA YOU NEED:
After the signature passes, extract these fields from the verified payload:
    stripeCustomerId = data.object.customer            (string)
    amount           = data.object.amount              (integer, cents)
    timestamp        = data.object.created             (unix seconds)

MAPPING THE CUSTOMER to ORG:
1. Call **getOrgIdFromCustomer(stripeCustomerId)**
   – Looks up the Stripe Customer using our secret API key.
   – Returns \`orgId\` from \`customer.metadata.orgId\`.  
   – Throw if metadata.orgId is missing.

WRITING THE PURCHASE IN ATTIO:
2. Call **recordStripeCharge(orgId, amount, timestamp)**
   – Adds \`amount\` to the company’s \`creditsBought\`
   – Sets \`lastCreditPurchase\` to the ISO date derived from \`timestamp\`

WORKFLOW (strict order):
  1. getOrgIdFromCustomer(stripeCustomerId)
  2. recordStripeCharge(orgId, amount, timestamp)
  3. Return [] ← signals “all done”

CONSTRAINTS:
• Use **only** the tools listed in the metadata.
• Do not call any tool more than once per webhook.
• Produce no extra commentary; the judge module will reject deviations.
`;

const verifyWebhook = async (req: AgentRequest, resp: AgentResponse, ctx: AgentContext) => {
  const headers = req.get("headers") as Record<string, string>;
  const sigHeader = headers["stripe-signature"] ?? "";
  const rawBuf = await req.data.text();
  try {
    const event = stripe.webhooks.constructEvent(
      rawBuf,
      sigHeader,
      process.env.STRIPE_SIGNING_SECRET ?? ""
    );
    return true;
  } catch (error) {
    console.error("❌  Stripe verification failed:", error);
    return false;
  }
};

export default createAgent(
  prompt,
  toolMetadataList,
  toolExecutors,
  verifyWebhook
);