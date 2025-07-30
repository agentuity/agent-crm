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
    This will handle all the ATTIO record creation/update logic (steps 1-3 of the original workflow).

  2. Call the SMARTLEAD_SET_LEAD_STATUS_POSITIVE with input:
      {
        "email": "<lead_data.email>"
      }
  Once you have done this, you should not make any more tool calls and stop completely.

  3. Finally, call the SLACKBOT_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL tool.
  The message should be markdown, and *exactly*:

  "
  👀 *New Lead*
  <@ID>, you have a new lead from <lead_data.first_name> <lead_data.last_name> (<lead_data.email>) at <lead_data.company_name>. Check your inbox (<from_email>).
  "

  where ID is the user id of the person who should receive the message. You must determine this to be either Jeff Haynie, or Rick Blalock based on the from_email.
  The ids are:
  - Jeff Haynie: U08993W8V0T
  - Rick Blalock: U088UL77GDV
  You must keep the ids in the format <@ID> including the "<@" and ">".
  {
    "channel": "#yay",  
    "text": "<message you created based on the rules above>"
  }

If the event_type is EMAIL_REPLY, you should:
  1. call the SMARTLEAD_GET_LEAD_STATUS tool with input:
    {
      "email": "<to_email>"
    }
    1a. If the lead status is "positive", call the SLACKBOT_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL tool.
      The message should be markdown, and *exactly*:

      "
      📬 *New Reply*
      <@ID>, you have an email to look at in your inbox (<from_email>) from <to_name> (<to_email>).
      "

      where ID is the user id of the person who should receive the message. You must determine this to be either Jeff Haynie or Rick Blalock based on the from_email.
      The ids are:
      - Jeff Haynie: U08993W8V0T
      - Rick Blalock: U088UL77GDV
      You must keep the ids in the format <@ID> including the "<@" and ">".
      {
        "channel": "#yay",
        "text": "<message you created based on the rules above>"
      }
    1b. If the lead status is not "positive" (including empty reply or nothing), do nothing.
  
  After Step 1, you should have sent a message to the appropriate person. Once you have done this, you should stop.
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
