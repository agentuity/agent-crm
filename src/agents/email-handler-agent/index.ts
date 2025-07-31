import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { Composio } from "@composio/core";
import { Anthropic } from "@anthropic-ai/sdk";
import { toolExecutors } from "./tools";

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
          body: string;
          campaign_id: string;
          stats_id: string;
        };
        let from_email = email_data.from_email;
        let body = email_data.body;
        let campaign_id = email_data.campaign_id;
        let stats_id = email_data.stats_id;
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
          The email is to: ${from_email}
          The email body is:
          ${body}

          # Output

          You should output with one of two things EXACTLY:
          1. Email body including greeting and signature - no reasoning, just the body.
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
                channel: "#agent-test-channel-nick",
                text: `📬 *Email!*
                    <@${userId}>, you have a new reply from ${to_email} and my small LLM brain couldn't figure out a response. Check your inbox (${to_email}).
                    `,
              },
            }
          );
        } else {
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
      }
    }

    // We've processed all the emails, so we can clear the KV.

    // Technically a race condition? - if someone gets their lead status updated
    // while we're in the middle of processing, they will be missed.
    // Feel that odds of that are very slim, but still a risk.

    // await ctx.kv.set("agent-crm-positive-leads", "emails", []);

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
