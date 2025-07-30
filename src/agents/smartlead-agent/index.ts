import { createAgent } from "../../../lib/agent";
import { toolMetadataList, toolExecutors } from "./tools";

const prompt = `
You are receiving email webhooks from SmartLead. You are responsible for managing people in Attio based on email interactions.

## Webhook Structure
Email webhooks may be one of two types which can be determined by the event_type field:
- event_type: LEAD_CATEGORY_UPDATED or EMAIL_REPLY

If the event_type is LEAD_CATEGORY_UPDATED, the webhook will contain the following important fields:
- lead_data.email: The email of the potential lead.
- lead_data.first_name: The first name of the potential lead.
- lead_data.last_name: The last name of the potential lead.
- lead_data.company_name: The name of the company the potential lead is associated with.
- from_email: The email of the person in our organization who sent the original email

If the event_type is EMAIL_REPLY, the webhook will contain the following important fields:
- from_email: The email of the person in our organization who sent the original email
- to_email: The email of the potential lead
- to_name: The name of the potential lead
- reply_message.html: The body of the email reply
- campaign_id: The id of the campaign that the email reply is associated with
- stats_id: The id of the email stats that the email reply is associated with

## Workflow
Based on the event type you should follow one of the following workflows **sequentially, with no deviation**.
If you receive an unexpected result from any step, you should immediately stop and explain the issue.

You MUST fill out all parameters for each tool call.

If the event_type is LEAD_CATEGORY_UPDATED, you should:
  1. call the HANDLE_LEAD_CATEGORY_UPDATED_ATTIO tool with input:
    {
      "lead_data": {
        "email": "<lead_data.email>",
        "first_name": "<lead_data.first_name>",
        "last_name": "<lead_data.last_name>",
        "company_name": "<lead_data.company_name>"
      }
    }

  2. Call the SMARTLEAD_SET_LEAD_STATUS_POSITIVE with input:
      {
        "email": "<lead_data.email>"
      }

  3. Finally, call the KV_STORE_POSITIVE_LEAD tool with input:
    {
      "email": "<lead_data.email>"
    }
  You should receive a success response.

If the event_type is EMAIL_REPLY, you should:
  1. Call the KV_STORE_EMAIL tool with input:
    {
      "from_email": "<from_email>",
      "to_email": "<to_email>",
      "body": "<reply_message.html>",
      "campaign_id": "<campaign_id>",
      "stats_id": "<stats_id>"
    }
  You should receive a success response.
`;

const truncatePayload = (payload: any) => {
  if (payload.event_type === "LEAD_CATEGORY_UPDATED") {
    return {
      lead_data: {
        event_type: payload.event_type,
        email: payload.lead_data.email,
        first_name: payload.lead_data.first_name,
        last_name: payload.lead_data.last_name,
        company_name: payload.lead_data.company_name,
      },
      from_email: payload.from_email,
    };
  } else if (payload.event_type === "EMAIL_REPLY") {
    return {
      event_type: payload.event_type,
      from_email: payload.from_email,
      to_email: payload.to_email,
      to_name: payload.to_name,
      reply_message: {
        html: payload.reply_message.html,
      },
      campaign_id: payload.campaign_id,
      stats_id: payload.stats_id,
    };
  }
};
export default createAgent(
  prompt,
  toolMetadataList,
  toolExecutors,
  "claude-3-7-sonnet-20250219",
  undefined,
  truncatePayload
);
