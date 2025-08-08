import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { Composio } from "@composio/core";
import { Anthropic } from "@anthropic-ai/sdk";
import { toolExecutors, callSmartLeadAPI } from "./tools";

const client = new Anthropic();

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  const composio = new Composio({
    apiKey: process.env.COMPOSIO_API_KEY,
  });

  let dataResponse = await ctx.kv.get("agent-crm-positive-leads", "emails");
  if (dataResponse.exists) {
    let positive_emails = (await dataResponse.data.json()) as any[];

    for (let to_email of positive_emails) {
      dataResponse = await ctx.kv.get("agent-crm-emails", to_email);
      if (dataResponse.exists) {
        let email_data = (await dataResponse.data.json()) as {
          from_email: string;
          to_name: string;
          body: string;
          campaign_id: string;
          stats_id: string;
        };

        let from_email = email_data.from_email;
        let to_name = email_data.to_name;
        let body = email_data.body;
        let campaign_id = email_data.campaign_id;
        let stats_id = email_data.stats_id;

        // Get the lead via the email and retreive campaign_lead_map_id (for including the link in slack message)
        // and lead_id (to get the message history)
        let campaign_lead_map_id = null;
        let lead_id = null;

        try {
          const leadResponse = await callSmartLeadAPI(
            `https://server.smartlead.ai/api/v1/leads/?email=${to_email}`
          );
          let leadCampaignData = leadResponse.lead_campaign_data as any[];
          let campaign = leadCampaignData.filter(
            (obj) => obj.campaign_id == campaign_id
          ) as any;
          campaign_lead_map_id = campaign[0]?.campaign_lead_map_id;
          lead_id = leadResponse.id;
        } catch (e) {
          ctx.logger.info(`Failed to get the campaign_lead_map_id: ${e}`);
        }

        if (!campaign_lead_map_id) {
          ctx.logger.error("Could not find campaign_lead_map_id");
          continue;
        }

        if (!lead_id) {
          ctx.logger.error("Could not find lead_id");
          continue;
        }

        // Check if the most recent message in the email thread is from the user or from us.
        const messageHistoryResponse = await callSmartLeadAPI(
          `https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads/${lead_id}/message-history`
        );
        let history = messageHistoryResponse.history;
        let mostRecentMessage = history[history.length - 1];
        let mostRecentSender = mostRecentMessage.from;

        ctx.logger.info("mostRecentSender:", mostRecentSender);
        if (mostRecentSender === from_email) {
          ctx.logger.info(
            "Most recent message in thread is from Agentuity, not replying or pinging."
          );
          continue;
        }

        let prompt = `
          # Task

          The email is from a lead, and the lead is interested in our services. Your job is to suggest a reply to this email that came from the lead, but if the response is outside of your skills as defined below, we will have a human respond instead of you. In that case, you do NOT NEED TO GENERATE A REPLY. You are writing on behalf of ${from_email}, so reply as if you are them.

          # Tone & Voice

          - Your response should sound like internal communication, not marketing and not straight-arrowed or overly professional
          - No corporate jargon, buzzwords, etc
          - Be personable like you're talking to a friend; be genuine
          - Don't overcomplicate the response with unnecessary sentences
          
          # Known Facts

          You know the following information, and only this information:

          1. The calendar link for setting up a meeting can be determined from the email: ${from_email}
            - If the email is to Jeff Haynie, his calendar link is: https://cal.com/jeffhaynie/15min
            - If the email is to Rick Blalock, his calendar link is: https://cal.com/rblalock/15min
          2. You do not know anyone's availability, but you know that you can send a calendar link if someone wants to book a meeting. If someone suggests a specific date/time, just brush that off and respond with something like "You can find a time on my calendar here: [LINK]". Do not reference the fact that they asked about a specific time slot.
          2. Pricing can be found at this link: https://agentuity.com/pricing
          3. The docs website is found at this link: https://agentuity.dev/Introduction
          4. We are open to talking about different *open-ended* topics, in the event of an open-ended request (i.e. about partnership), you *must* treat it the same as a meeting request and have the lead schedule with a calendar link. Do not sugguest anything other than openness to talk.
          5. You do not know specific technical facts about the company or internal affairs.
          
          # Workflow

          1. First, determine all of the questions the lead is asking (if any).
          2. Determine if each of the questions can be answered using your Known Facts.
          3. If you determine that all questions can be answered, generate a reply to the lead. 
          4. If you cannot answer _every_ question, output 'INVALID'.
          
          # Input

          The email is from: ${to_email}
          The email is to: ${to_name} (${from_email})
          The email body is:
          ${body}

          # Output Format

          IMPORTANT: Format the email as HTML. Use <br> for newlines. \n will not work.

          You should output with one of two things EXACTLY:
          1. Email body including greeting and signature - no reasoning, just the body. Use double newlines between paragraphs.
          2. 'INVALID' - the string literal with no other reasoning or text.
        `;

        let response = await client.messages.create({
          model: "claude-3-7-sonnet-20250219",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
          stream: false,
        });

        let text: string = "";
        if (response.content[0]?.type === "text") {
          text = response.content[0].text;
        }

        if (text === "INVALID") {
          // Ping someone in slack.
          let userId = "";
          const fromEmailLower = from_email.toLowerCase();
          if (
            fromEmailLower.includes("rick") ||
            fromEmailLower.includes("blalock")
          ) {
            userId = "U088UL77GDV"; // Rick Blalock
          } else if (
            fromEmailLower.includes("jeff") ||
            fromEmailLower.includes("haynie")
          ) {
            userId = "U08993W8V0T"; // Jeff Haynie
          }
          const pingResult = await composio.tools.execute(
            "SLACKBOT_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
            {
              userId: "default",
              arguments: {
                channel: "#yay",
                text: `📬 *Email!*
<@${userId}>, you have a new message from ${to_email} that needs your response. Check your inbox (https://app.smartlead.ai/app/master-inbox?action=INBOX&leadMap=${campaign_lead_map_id}).
`,
              },
            }
          );
        } else {
          ctx.logger.info("email body:", text);
          // Send a reply via smartlead API.
          // Get the tool executor with name SMARTLEAD_SEND_EMAIL_REPLY
          const smartleadSendEmailReplyExecutor =
            toolExecutors["SMARTLEAD_SEND_EMAIL_REPLY"];
          if (smartleadSendEmailReplyExecutor) {
            await smartleadSendEmailReplyExecutor(
              {
                campaign_id,
                email: to_email,
                email_body: text,
                stats_id,
              },
              ctx
            );
          }
        }

        let archive_emails = await ctx.kv.get(
          "agent-crm-positive-leads",
          "archive"
        );
        if (archive_emails.exists) {
          let archive_emails_data = (await archive_emails.data.json()) as any[];
          if (!archive_emails_data.includes(to_email)) {
            archive_emails_data.push(to_email);
            await ctx.kv.set(
              "agent-crm-positive-leads",
              "archive",
              archive_emails_data
            );
          }
        } else {
          await ctx.kv.set("agent-crm-positive-leads", "archive", [to_email]);
        }

        // Now that we have processed this email we should delete it from the KV.
        await ctx.kv.delete("agent-crm-emails", to_email);
      }
    }

    // We've processed all the emails, so we can clear the KV.

    // Technically a race condition? - if someone gets their lead status updated
    // while we're in the middle of processing, they will be missed.
    // Feel that odds of that are very slim, but still a risk.

    await ctx.kv.set("agent-crm-positive-leads", "emails", []);

    ctx.logger.info(
      `Finished processing positive emails. ${positive_emails.length} emails processed.`
    );
    return resp.text(
      `Finished processing positive emails. ${positive_emails.length} emails processed.`
    );
  } else {
    ctx.logger.info("Failed to get positive emails from KV");
    return resp.text("Failed to get positive emails from KV");
  }
}
