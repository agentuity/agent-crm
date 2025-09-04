import type { AgentRequest, AgentResponse, AgentContext } from "@agentuity/sdk";
import { createAgent } from "../../../lib/agent";
import { toolMetadataList, toolExecutors } from "./tools";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_API_KEY ?? "", {
  apiVersion: "2025-06-30.basil",
});

const today = new Date().toISOString().slice(0, 10);

const prompt = `
You are an automated backend agent that handles **Stripe 'charge.succeeded' webhooks**.  
Your job: when a charge succeeds, add that amount (in **cents**) to the company’s *credits_bought* field in Attio.

────────────────────────────────────────
ALLOWED TOOLS – USE **ONLY** THESE FIVE
────────────────────────────────────────
• getOrgIdFromCustomer  
• ATTIO_FIND_RECORD  
• ATTIO_UPDATE_RECORD  
• latestAttioNumber (our local helper)
• SLACKBOT_SEND_MESSAGE  

☞ Every other Composio tool is OUT OF SCOPE and must NOT be called.  
The Judge will reject the run if you call anything else.

───────────────────
Exact step-by-step plan
───────────────────
1. Parse the webhook JSON  
   • stripeCustomerId = data.object.customer (string)  
   • amount = data.object.amount    (integer — already in cents)  

2. **getOrgIdFromCustomer**  
   • arguments = { customerId: <stripeCustomerId> }  
   → orgId = <tool result string>

3. **ATTIO_FIND_RECORD**  
   • object_id  = "companies"  
   • attributes = { org_id: <orgId> }  
   • limit      = 1  
   → Save record_id and credits_bought
   → Save companyName = record.values.name[0].value

4. Determine **currentCredits** and **purchaseDate**  
   • If \`credits_bought\` is **empty or missing**:  
     - currentCredits = 0  
     - purchaseDate   = "${today}"   
   • Otherwise:  
     - currentCredits = latestAttioNumber(credits_bought)  
     - purchaseDate   = "${today}"

5. newCredits = currentCredits + amount

6. **ATTIO_UPDATE_RECORD**  
   • object_id   = "companies"  
   • record_id   = <record_id>  
   • body.values = {  
       credits_bought         : newCredits,  
       last_credit_purchase : purchaseDate  
     }

7. Send Slack notification  
   Finally, call the SLACKBOT_SEND_MESSAGE tool with exactly this JSON:  
   {  
     "channel": "#yay",  
           "text": "🤑🤑🤑 *New Credit Purchase!*\n*Organization:* \${companyName} (\${orgId})\n*Amount Purchased:* \${amountDollars}\n*Updated Balance:* \${balanceDollars}"
     }
     
     **Calculation rules:**
     - amount is already in dollars. amountDollars = amount (e.g. 100 = $100.00)
     - newCredits is already in dollars. balanceDollars = newCredits (e.g. 1400 = $1,400.00)
     - Format with comma separators and two decimal places  
   }


8. If you have updated the record, stop here. Do not perform any further updates or actions after this step.
   Reply with **exactly**: {"status":"ok"}

──────────
Hard rules
──────────
• Only the four tools above may be called.  
• Never call the same tool twice.  
• No extra commentary; only tool calls or the final JSON.
• If credits_bought is empty, default to 0 and still perform ATTIO_UPDATE_RECORD with today’s date.
`;

const verifyWebhook = async (
  rawBody: string,
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) => {
  const headers = req.get("headers") as Record<string, string>;
  const sigHeader = headers["stripe-signature"] ?? "";
  try {
    stripe.webhooks.constructEvent(
      rawBody,
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
  "claude-3-7-sonnet-latest",
  verifyWebhook
);
