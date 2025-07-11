import { ConsoleLogWriter } from "drizzle-orm";
import * as attio from "../../../lib/attio";
import { z } from "zod";

// --- Tool Definitions ---

export const toolMetadataList = [
  {
    name: "email_replied",
    description:
      "This is the tool you should call when you receive an email reply event from SmartLead. You should only call this tool if the event_type is EMAIL_REPLY.",
    parameters: {
      from_email: "string",
      to_email: "string",
      to_name: "string",
      slack_user_id: "string",
    },
  },
  {
    name: "lead_category_updated",
    description:
      "This is the tool you should call when you receive a lead category updated event from SmartLead. You should only call this tool if the event_type is LEAD_CATEGORY_UPDATED.",
    parameters: {
      lead_email: "string",
      lead_first_name: "string",
      lead_last_name: "string",
      lead_company_name: "string",
    },
  },
];

interface SmartLeadResponse {
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
  const response = await fetch(url + `&api_key=${api_key}`);
  if (!response.ok) {
    throw new Error("Failed to get data from SmartLead");
  }
  const data = (await response.json()) as SmartLeadResponse;
  return data;
}

// --- Tool Executors ---
export const toolExecutors: Record<string, Function> = {
  email_replied: async ({
    from_email,
    to_email,
    to_name,
    slack_user_id,
  }: {
    from_email: string;
    to_email: string;
    to_name: string;
    slack_user_id: string;
  }) => {
    // TODO: Request from SmartLead API to get the lead status

    let smartlead_response = await getFromSmartLead(
      `https://server.smartlead.ai/api/v1/leads/?email=${to_email}`
    );
    console.log("SmartLead data:", smartlead_response);
    let lead_status = smartlead_response?.custom_fields?.custom_lead_status;
    console.log("Lead status:", lead_status);
    if (lead_status !== "positive") {
      console.log("Lead is not positive, skipping.");
      return;
    }
    console.log("Lead is positive, pinging Slack.");

    // Ping Slack
    const webhookUrl = process.env.SLACK_WEBHOOK;
    if (!webhookUrl) {
      throw new Error("SLACK_WEBHOOK environment variable is not set");
    }
    const payload = {
      text: `<@NO> You have an email to look at in your inbox: ${to_email} from ${to_name} (${from_email})`,
    };
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Slack webhook failed: ${res.status} - ${text}`);
    }
  },
  lead_category_updated: async ({
    lead_email,
    lead_first_name,
    lead_last_name,
    lead_company_name,
  }: {
    lead_email: string;
    lead_first_name: string;
    lead_last_name: string;
    lead_company_name: string;
  }) => {
    // Add to Attio
    let person = await attio.getPersonByEmail(lead_email);
    if (person) console.log("Got person.", person);
    let personRecordId;
    if (person.data.length === 0) {
      console.log("No person found, asserting.");
      await attio.assertPerson({
        email: lead_email,
        firstName: lead_first_name,
        lastName: lead_last_name,
        leadSource: "SmartLead",
      });
      person = await attio.getPersonByEmail(lead_email);
      if (person.data.length >= 0) console.log("Got person after asserting.");
      personRecordId = attio.getRecordIdFromPerson(person);
      if (personRecordId) console.log("Got person record id after asserting.");
    } else {
      personRecordId = attio.getRecordIdFromPerson(person);
      if (personRecordId)
        console.log("Got person record id after getting person.");
      await attio.assertPerson({ email: lead_email, leadSource: "SmartLead" });
    }
    // Add to Pipeline
    const company = await attio.getCompanyByPersonEmail(lead_email);
    if (company) {
      console.log("Got company.");
      const companyRecordId = attio.getRecordIdFromCompany(company);
      if (companyRecordId) console.log("Got company record id.");
      if (companyRecordId && personRecordId) {
        await attio.addCompanyToPipeLine(
          companyRecordId,
          personRecordId,
          lead_company_name
        );
      }
    } else {
      console.log("Person does not have associated company in Attio.");
    }

    // Update lead status in SmartLead
    let smartlead_response = await getFromSmartLead(
      `https://server.smartlead.ai/api/v1/leads/?email=${lead_email}`
    );
    console.log("SmartLead data:", smartlead_response);
    if (smartlead_response) {
      let lead_id = smartlead_response?.id;
      console.log("Lead ID:", lead_id);
      let campaign_id =
        smartlead_response?.lead_campaign_data?.[0]?.campaign_id;
      console.log("Campaign ID:", campaign_id);
      if (lead_id && campaign_id) {
        const api_key = process.env.SMARTLEAD_API_KEY;
        const url = `https://server.smartlead.ai/api/v1/campaigns/${campaign_id}/leads/${lead_id}?api_key=${api_key}`;
        const lead_input = {
          email: lead_email, // <-- ensure this is present
          custom_fields: {
            custom_lead_status: "positive",
          },
        };
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lead_input),
        });
        const result = await response.json();
        console.log("SmartLead campaign/lead update response:", result);
      }
    } else {
      console.log("Person not found in SmartLead.");
    }
  },

  // getLeadStatusByEmail: async ({ email }: { email: string }) => {
  //   const smartlead_api_key = process.env.SMARTLEAD_API_KEY;
  //   if (!smartlead_api_key) {
  //     throw new Error("SMARTLEAD_API_KEY environment variable is not set");
  //   }
  //   const response = await fetch(
  //     `https://server.smartlead.ai/api/v1/leads/?api_key=${smartlead_api_key}&email=${email}`
  //   );
  //   const data = await response.json();
  //   return data;
  // },
};
