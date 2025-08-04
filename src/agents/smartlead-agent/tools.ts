// SmartLead API helpers and tools
import type { AgentContext } from "@agentuity/sdk";
import { Composio } from "@composio/core";
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
});
export interface SmartLeadResponse {
  id?: string;
  lead_campaign_data?: {
    campaign_id?: string;
  }[];
  custom_fields?: {
    custom_lead_status?: string;
  };
}

// --- Tool Definitions ---

export const toolMetadataList = [
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
        campaign_id: {
          type: "string",
          description: "The campaign ID associated with the email.",
          title: "Campaign ID",
          examples: ["campaign_123"],
        },
        stats_id: {
          type: "string",
          description: "The stats ID associated with the email.",
          title: "Stats ID",
          examples: ["stats_123"],
        },
      },
      required: ["from_email", "to_email", "body", "campaign_id", "stats_id"],
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
  {
    name: "KV_CHECK_ARCHIVE",
    description: "Check if an email is in the archive KV.",
    input_schema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "The email address to check.",
          title: "Email",
          examples: ["john.doe@example.com"],
        },
      },
      required: ["email"],
      title: "KVCheckArchiveRequest",
    },
    cache_control: undefined,
  },
  {
    name: "HANDLE_LEAD_CATEGORY_UPDATED_ATTIO",
    description:
      "Handle LEAD_CATEGORY_UPDATED event by creating/updating records in Attio (steps 1-3 of the workflow).",
    input_schema: {
      type: "object",
      properties: {
        lead_data: {
          type: "object",
          properties: {
            email: { type: "string" },
            first_name: { type: "string" },
            last_name: { type: "string" },
            company_name: { type: "string" },
          },
          required: ["email", "first_name", "last_name", "company_name"],
        },
        from_email: { type: "string" },
      },
      required: ["lead_data", "from_email"],
      title: "HandleLeadCategoryUpdatedAttioRequest",
    },
    cache_control: undefined,
  },
];

// --- Tool Executors ---
export const toolExecutors: Record<string, Function> = {
  KV_STORE_EMAIL: async (
    {
      from_email,
      to_email,
      body,
      campaign_id,
      stats_id,
    }: {
      from_email: string;
      to_email: string;
      body: string;
      campaign_id: string;
      stats_id: string;
    },
    ctx: AgentContext
  ) => {
    try {
      await ctx.kv.delete("agent-crm-emails", to_email);
      await ctx.kv.set(
        "agent-crm-emails",
        to_email,
        { from_email, body, campaign_id, stats_id },
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
      let dataResponse = await ctx.kv.get("agent-crm-positive-leads", "emails");
      if (dataResponse.exists) {
        let data = (await dataResponse.data.json()) as any[];
        // Ensure no duplicates
        if (!data.includes(email)) {
          data.push(email);
          await ctx.kv.set("agent-crm-positive-leads", "emails", data);
        }
      } else {
        await ctx.kv.set("agent-crm-positive-leads", "emails", [email]);
      }
      return { success: true };
    } catch (error) {
      ctx.logger.error("Failed to store positive lead in KV: %s", error);
      throw error;
    }
  },

  KV_CHECK_ARCHIVE: async ({ email }: { email: string }, ctx: AgentContext) => {
    let archive_emails = await ctx.kv.get(
      "agent-crm-positive-leads",
      "archive"
    );
    if (archive_emails.exists) {
      let archive_emails_data = (await archive_emails.data.json()) as any[];
      return archive_emails_data.includes(email);
    }
    return false;
  },

  HANDLE_LEAD_CATEGORY_UPDATED_ATTIO: async ({
    lead_data,
  }: {
    lead_data: {
      email: string;
      first_name: string;
      last_name: string;
      company_name: string;
    };
  }) => {
    try {
      // Step 1: Find or create person record
      const search = await composio.tools.execute("ATTIO_FIND_RECORD", {
        userId: "default",
        arguments: {
          object_id: "people",
          attributes: { email_addresses: lead_data.email },
          limit: 1,
        },
      });
      console.log("search:", search);

      // Extract record_id from the search result
      let personRecordId =
        (search.data as any)?.records?.[0]?.id?.record_id || null;
      console.log("personRecordId:", personRecordId);

      if (personRecordId === null) {
        // Person not found, create new record
        const personCreateResult = await composio.tools.execute(
          "ATTIO_CREATE_RECORD",
          {
            userId: "default",
            arguments: {
              object_type: "people",
              values: {
                email_addresses: [
                  {
                    email_address: lead_data.email,
                  },
                ],
                name: {
                  first_name: lead_data.first_name,
                  last_name: lead_data.last_name,
                  full_name: `${lead_data.first_name} ${lead_data.last_name}`,
                },
                lead_source: "SmartLead",
              },
            },
          }
        );
        console.log("personCreateResult:", personCreateResult);
        personRecordId =
          (personCreateResult.data as any)?.id?.record_id || null;
        console.log("personRecordId:", personRecordId);
      }

      // Step 2: Find or create company record
      const companySearch = await composio.tools.execute("ATTIO_FIND_RECORD", {
        userId: "default",
        arguments: {
          object_id: "companies",
          attributes: { name: lead_data.company_name },
          limit: 1,
        },
      });
      console.log("companySearch:", companySearch);

      let companyRecordId =
        (companySearch.data as any)?.records?.[0]?.id?.record_id || null;
      console.log("companyRecordId:", companyRecordId);

      if (companyRecordId === null) {
        // Company not found, create new record
        const companyCreateResult = await composio.tools.execute(
          "ATTIO_CREATE_RECORD",
          {
            userId: "default",
            arguments: {
              object_type: "companies",
              values: { name: lead_data.company_name },
            },
          }
        );
        console.log("companyCreateResult:", companyCreateResult);
        companyRecordId =
          (companyCreateResult.data as any)?.id?.record_id || null;
        console.log("companyRecordId:", companyRecordId);
      }

      // Step 3: Find and update or create deal record
      const dealSearch = await composio.tools.execute("ATTIO_FIND_RECORD", {
        userId: "default",
        arguments: {
          object_id: "deals",
          attributes: {
            associated_company: { target_record_id: companyRecordId },
          },
          limit: 1,
        },
      });
      console.log("dealSearch:", dealSearch);
      let dealRecordId =
        (dealSearch.data as any)?.records?.[0]?.id?.record_id || null;
      console.log("dealRecordId:", dealRecordId);

      if (dealRecordId === null) {
        // Deal not found, create new record
        const dealCreateResult = await composio.tools.execute(
          "ATTIO_CREATE_RECORD",
          {
            userId: "default",
            arguments: {
              object_type: "deals",
              values: {
                name: `Deal with ${lead_data.company_name}`,
                stage: "Lead",
                owner: "rblalock@agentuity.com",
                value: 0,
                associated_people: [personRecordId],
                associated_company: companyRecordId,
              },
            },
          }
        );
        console.log("dealCreateResult:", dealCreateResult);
        dealRecordId = (dealCreateResult.data as any)?.id?.record_id || null;
        console.log("dealRecordId:", dealRecordId);
      } else {
        // Deal exists, update with new person
        // Get existing associated people
        const existingDeal = (dealSearch.data as any)?.records?.[0];
        const existingAssociatedPeople = (existingDeal?.associated_people ||
          []) as any[];
        const existingPersonIds = existingAssociatedPeople.map(
          (person: any) => person.target_record_id
        );
        // Update deal with new person
        const dealUpdateResult = await composio.tools.execute(
          "ATTIO_UPDATE_RECORD",
          {
            userId: "default",
            arguments: {
              object_type: "deals",
              record_id: dealRecordId,
              values: {
                associated_people: [...existingPersonIds, personRecordId],
              },
            },
          }
        );
        console.log("dealUpdateResult:", dealUpdateResult);
      }

      return {
        success: true,
        message: "ATTIO records created/updated successfully",
        personRecordId,
        companyRecordId,
        dealRecordId,
      };
    } catch (error) {
      console.error("Error in HANDLE_LEAD_CATEGORY_UPDATED_ATTIO:", error);
    }
  },
};
