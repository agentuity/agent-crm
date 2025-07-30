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

  console.log("Full URL:", fullUrl);
  console.log("Body:", body);
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(fullUrl, options);

  // Log response details for debugging
  console.log("Response status:", response.status);
  console.log(
    "Response headers:",
    Object.fromEntries(response.headers.entries())
  );

  if (!response.ok) {
    // Try to get error details from response
    let errorMessage = `SmartLead API call failed: ${response.status} ${response.statusText}`;
    try {
      const errorText = await response.text();
      console.log("Error response body:", errorText);
      errorMessage += ` - Response: ${errorText}`;
    } catch (e) {
      console.log("Could not read error response body");
    }
    throw new Error(errorMessage);
  }

  // Handle response - SmartLead API returns HTML responses for success
  const contentType = response.headers.get("content-type");
  const responseText = await response.text();

  if (contentType && contentType.includes("application/json")) {
    try {
      return JSON.parse(responseText);
    } catch (error) {
      console.log("Failed to parse JSON response:", responseText);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse JSON response: ${errorMessage}. Response: ${responseText}`
      );
    }
  } else {
    // SmartLead API returns HTML responses for success
    console.log("Received HTML response:", responseText);
    return {
      success: true,
      message: responseText,
      contentType: contentType,
    };
  }
}

// Tool metadata
export const toolMetadataList = [
  {
    name: "SMARTLEAD_SEND_EMAIL_REPLY",
    description:
      "Send an email reply through SmartLead by email stats and campaign ID.",
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
        stats_id: {
          type: "string",
          description: "The stats ID of the email to reply to.",
          title: "Stats ID",
          examples: ["stats_123"],
        },
      },
      required: ["campaign_id", "email", "email_body", "stats_id"],
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
      stats_id,
    }: {
      campaign_id: string;
      email: string;
      email_body: string;
      stats_id: string;
    },
    ctx: AgentContext
  ) => {
    try {
      ctx.logger.info(
        "Starting SmartLead email reply workflow for campaign: %s, email: %s, stats_id: %s",
        campaign_id,
        email,
        stats_id
      );

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
