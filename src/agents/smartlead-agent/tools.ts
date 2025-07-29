// SmartLead API helpers and tools

import type { AgentContext } from "@agentuity/sdk";

// export interface SmartLeadResponse {
//   id?: string;
//   lead_campaign_data?: {
//     campaign_id?: string;
//   }[];
//   custom_fields?: {
//     custom_lead_status?: string;
//   };
// }

// async function getFromSmartLead(url: string): Promise<SmartLeadResponse> {
//   const api_key = process.env.SMARTLEAD_API_KEY;
//   if (!api_key) {
//     throw new Error("SMARTLEAD_API_KEY environment variable is not set");
//   }
//   const new_url = url + `&api_key=${api_key}`;
//   console.log("new_url:", new_url);
//   const response = await fetch(new_url);
//   if (!response.ok) {
//     throw new Error("Failed to get data from SmartLead");
//   }
//   const data = (await response.json()) as SmartLeadResponse;
//   return data;
// }

// async function updateSmartLeadStatus(
//   lead_email: string,
//   custom_lead_status: string
// ) {
//   // Get lead info
//   let smartlead_response = await getFromSmartLead(
//     `https://server.smartlead.ai/api/v1/leads?email=${encodeURIComponent(
//       lead_email.trim()
//     )}`
//   );
//   if (smartlead_response) {
//     let lead_id = smartlead_response?.id;
//     let campaign_id = smartlead_response?.lead_campaign_data?.[0]?.campaign_id;
//     if (lead_id && campaign_id) {
//       const api_key = process.env.SMARTLEAD_API_KEY;
//       const url = `https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads/${lead_id}?api_key=${api_key}`;
//       const lead_input = {
//         email: lead_email,
//         custom_fields: {
//           custom_lead_status,
//         },
//       };
//       const response = await fetch(url, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(lead_input),
//       });
//       if (!response.ok) {
//         throw new Error(
//           `Failed to update lead status: ${response.status} ${response.statusText}`
//         );
//       }
//       const result = await response.json();
//       return result;
//     }
//   }
//   throw new Error("Person not found in SmartLead or missing campaign/lead id.");
// }

// --- Tool Definitions ---

export const toolMetadataList = [
  // {
  //   name: "SMARTLEAD_GET_LEAD_STATUS",
  //   description:
  //     "Get the lead status from SmartLead for a given email address.",
  //   input_schema: {
  //     type: "object",
  //     properties: {
  //       email: {
  //         type: "string",
  //         description: "The email address of the lead to check.",
  //         title: "Lead Email",
  //         examples: ["john.doe@example.com"],
  //       },
  //     },
  //     required: ["email"],
  //     title: "GetLeadStatusRequest",
  //   },
  //   cache_control: undefined,
  // },
  // {
  //   name: "SMARTLEAD_SET_LEAD_STATUS_POSITIVE",
  //   description:
  //     'Set the lead status to "positive" in SmartLead for a given email address.',
  //   input_schema: {
  //     type: "object",
  //     properties: {
  //       email: {
  //         type: "string",
  //         description: "The email address of the lead to update.",
  //         title: "Lead Email",
  //         examples: ["john.doe@example.com"],
  //       },
  //     },
  //     required: ["email"],
  //     title: "SetLeadStatusPositiveRequest",
  //   },
  //   cache_control: undefined,
  // },
  {
    name: "KV_STORE_EMAIL",
    description: "Store an email in the KV store.",
    input_schema: {
      type: "object",
      properties: {
        from_email: {
          type: "string",
          description: "The email address of the sender.",
          title: "From Email",
          examples: ["john.doe@example.com"],
        },
        to_email: {
          type: "string",
          description: "The email address of the recipient.",
          title: "To Email",
          examples: ["jane.doe@example.com"],
        },
        body: {
          type: "string",
          description: "The body of the email.",
          title: "Body",
          examples: ["Hello, how are you?"],
        },
      },
      required: ["from_email", "to_email", "body"],
      title: "KVStoreEmailRequest",
    },
    cache_control: undefined,
  },
  {
    name: "KV_STORE_POSITIVE_LEAD",
    description: "Store a positive lead in the KV store.",
    input_schema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "The email address of the lead to store.",
          title: "Lead Email",
          examples: ["john.doe@example.com"],
        },
      },
      required: ["email"],
      title: "KVStorePositiveLeadRequest",
    },
    cache_control: undefined,
  },
];

// --- Tool Executors ---
export const toolExecutors: Record<string, Function> = {
  // SMARTLEAD_GET_LEAD_STATUS: async (
  //   { email }: { email: string },
  //   ctx: AgentContext
  // ) => {
  //   try {
  //     const smartlead_response = await getFromSmartLead(
  //       `https://server.smartlead.ai/api/v1/leads?email=${encodeURIComponent(
  //         email.trim()
  //       )}`
  //     );
  //     const lead_status = smartlead_response?.custom_fields?.custom_lead_status;
  //     return { lead_status };
  //   } catch (error) {
  //     ctx.logger.error("Failed to get lead status: %s", error);
  //     throw error;
  //   }
  // },

  // SMARTLEAD_SET_LEAD_STATUS_POSITIVE: async (
  //   { email }: { email: string },
  //   ctx: AgentContext
  // ) => {
  //   try {
  //     const result = await updateSmartLeadStatus(email, "positive");
  //     return { success: true, result };
  //   } catch (error) {
  //     ctx.logger.error("Failed to set lead status to positive: %s", error);
  //     throw error;
  //   }
  // },
  KV_STORE_EMAIL: async (
    {
      from_email,
      to_email,
      body,
    }: {
      from_email: string;
      to_email: string;
      body: string;
    },
    ctx: AgentContext
  ) => {
    try {
      await ctx.kv.set(
        "emails",
        to_email,
        { from_email, body },
        {
          ttl: 60 * 60 * 24 * 2, // 2 days
        }
      );
      return { success: true };
    } catch (error) {
      ctx.logger.error("Failed to store email in KV: %s", error);
      throw error;
    }
  },

  // Maintains an array of the emails of positive leads in the KV store.
  KV_STORE_POSITIVE_LEAD: async (
    { email }: { email: string },
    ctx: AgentContext
  ) => {
    try {
      let dataResponse = await ctx.kv.get("positive_leads", "emails");
      if (dataResponse.exists) {
        let data = (await dataResponse.data.json()) as any[];
        data.push(email);
        await ctx.kv.set("positive_leads", "emails", data);
      } else {
        await ctx.kv.set("positive_leads", "emails", [email]);
      }
      return { success: true };
    } catch (error) {
      ctx.logger.error("Failed to store positive lead in KV: %s", error);
      throw error;
    }
  },
};
