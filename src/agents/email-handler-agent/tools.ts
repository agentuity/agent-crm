import type { AgentContext } from "@agentuity/sdk";

// SmartLead API helper function
async function callSmartLeadAPI(
  url: string,
  method: string = "GET",
  body?: any
): Promise<any> {
  const api_key = process.env.SMARTLEAD_API_KEY;
  if (!api_key) {
    throw new Error("SMARTLEAD_API_KEY environment variable is not set");
  }

  const fullUrl = url.includes("?")
    ? `${url}&api_key=${api_key}`
    : `${url}?api_key=${api_key}`;

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(fullUrl, options);
  if (!response.ok) {
    throw new Error(
      `SmartLead API call failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

// Tool metadata
export const toolMetadataList = [
  {
    name: "SMARTLEAD_SEND_EMAIL_REPLY",
    description:
      "Send an email reply through SmartLead by getting lead information, email stats, and message history, then sending the reply.",
    input_schema: {
      type: "object",
      properties: {
        campaign_id: {
          type: "string",
          description: "The campaign ID for the email sequence.",
          title: "Campaign ID",
          examples: ["campaign_123"],
        },
        email: {
          type: "string",
          description: "The email address of the lead to reply to.",
          title: "Lead Email",
          examples: ["john.doe@example.com"],
        },
        email_body: {
          type: "string",
          description: "The body of the email reply to send.",
          title: "Email Body",
          examples: ["Thank you for your interest! I'd be happy to help."],
        },
      },
      required: ["campaign_id", "email", "email_body"],
      title: "SmartLeadSendEmailReplyRequest",
    },
    cache_control: undefined,
  },
];

// Tool executors
export const toolExecutors: Record<string, Function> = {
  SMARTLEAD_SEND_EMAIL_REPLY: async (
    {
      campaign_id,
      email,
      email_body,
    }: {
      campaign_id: string;
      email: string;
      email_body: string;
    },
    ctx: AgentContext
  ) => {
    try {
      ctx.logger.info(
        "Starting SmartLead email reply workflow for campaign: %s, email: %s",
        campaign_id,
        email
      );

      // Step 1: Get lead_id by email address
      ctx.logger.info("Step 1: Getting lead_id for email: %s", email);
      const leadResponse = await callSmartLeadAPI(
        `https://server.smartlead.ai/api/v1/leads/?email=${encodeURIComponent(
          email.trim()
        )}`
      );

      if (!leadResponse || !leadResponse.id) {
        throw new Error(`Lead not found for email: ${email}`);
      }

      const lead_id = leadResponse.id;
      ctx.logger.info("Found lead_id: %s", lead_id);

      // Step 2: Get message history to find the message to reply to and get email_stats_id
      ctx.logger.info(
        "Step 2: Getting message history for lead: %s, campaign: %s",
        lead_id,
        campaign_id
      );
      const messageHistoryResponse = await callSmartLeadAPI(
        `https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads/${lead_id}/message-history`
      );

      if (
        !messageHistoryResponse ||
        !messageHistoryResponse.history ||
        !Array.isArray(messageHistoryResponse.history)
      ) {
        throw new Error(
          `No message history found for lead: ${lead_id} in campaign: ${campaign_id}`
        );
      }

      // Get the most recent message to reply to (last in the array)
      const latestMessage =
        messageHistoryResponse.history[
          messageHistoryResponse.history.length - 1
        ];
      const { stats_id } = latestMessage;

      ctx.logger.info("Found message to reply to - Stats ID: %s", stats_id);

      // Step 3: Send the reply
      ctx.logger.info("Step 4: Sending email reply");
      const replyPayload = {
        email_stats_id: stats_id,
        email_body: email_body, // The new email body we are sending (from parameter)
      };

      const replyResponse = await callSmartLeadAPI(
        `https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/reply-email-thread`,
        "POST",
        replyPayload
      );

      ctx.logger.info("Email reply sent successfully");

      return {
        success: true,
        lead_id,
        email_stats_id: stats_id,
        message: "Email reply sent successfully",
        response: replyResponse,
      };
    } catch (error) {
      ctx.logger.error("Failed to send email reply: %s", error);
      throw error;
    }
  },
};
