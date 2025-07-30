// SmartLead API helpers and tools
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

async function getFromSmartLead(url: string): Promise<SmartLeadResponse> {
  const api_key = process.env.SMARTLEAD_API_KEY;
  if (!api_key) {
    throw new Error("SMARTLEAD_API_KEY environment variable is not set");
  }
  const new_url = url + `&api_key=${api_key}`;
  console.log("new_url:", new_url);
  const response = await fetch(new_url);
  if (!response.ok) {
    throw new Error("Failed to get data from SmartLead");
  }
  const data = (await response.json()) as SmartLeadResponse;
  return data;
}

async function updateSmartLeadStatus(
  lead_email: string,
  custom_lead_status: string
) {
  // Get lead info
  let smartlead_response = await getFromSmartLead(
    `https://server.smartlead.ai/api/v1/leads/?email=${lead_email}`
  );
  if (smartlead_response) {
    let lead_id = smartlead_response?.id;
    let campaign_id = smartlead_response?.lead_campaign_data?.[0]?.campaign_id;
    if (lead_id && campaign_id) {
      const api_key = process.env.SMARTLEAD_API_KEY;
      const url = `https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads/${lead_id}?api_key=${api_key}`;
      const lead_input = {
        email: lead_email,
        custom_fields: {
          custom_lead_status,
        },
      };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead_input),
      });
      const result = await response.json();
      return result;
    }
  }
  throw new Error("Person not found in SmartLead or missing campaign/lead id.");
}

// --- Tool Definitions ---

export const toolMetadataList = [
  {
    name: "SMARTLEAD_GET_LEAD_STATUS",
    description:
      "Get the lead status from SmartLead for a given email address.",
    input_schema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "The email address of the lead to check.",
          title: "Lead Email",
          examples: ["john.doe@example.com"],
        },
      },
      required: ["email"],
      title: "GetLeadStatusRequest",
    },
    cache_control: undefined,
  },
  {
    name: "SMARTLEAD_SET_LEAD_STATUS_POSITIVE",
    description:
      'Set the lead status to "positive" in SmartLead for a given email address.',
    input_schema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "The email address of the lead to update.",
          title: "Lead Email",
          examples: ["john.doe@example.com"],
        },
      },
      required: ["email"],
      title: "SetLeadStatusPositiveRequest",
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
  SMARTLEAD_GET_LEAD_STATUS: async ({ email }: { email: string }) => {
    const smartlead_response = await getFromSmartLead(
      `https://server.smartlead.ai/api/v1/leads?email=${encodeURIComponent(
        email.trim()
      )}`
    );
    const lead_status = smartlead_response?.custom_fields?.custom_lead_status;
    return { lead_status };
  },

  SMARTLEAD_SET_LEAD_STATUS_POSITIVE: async ({ email }: { email: string }) => {
    const result = await updateSmartLeadStatus(email, "positive");
    return { success: true, result };
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
