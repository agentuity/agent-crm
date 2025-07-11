// SmartLead API helpers

export interface SmartLeadResponse {
  id?: string;
  lead_campaign_data?: {
    campaign_id?: string;
  }[];
  custom_fields?: {
    custom_lead_status?: string;
  };
}

export async function getFromSmartLead(
  url: string
): Promise<SmartLeadResponse> {
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

export async function getLeadStatusByEmail(email: string) {
  const smartlead_api_key = process.env.SMARTLEAD_API_KEY;
  if (!smartlead_api_key) {
    throw new Error("SMARTLEAD_API_KEY environment variable is not set");
  }
  const response = await fetch(
    `https://server.smartlead.ai/api/v1/leads/?api_key=${smartlead_api_key}&email=${email}`
  );
  if (!response.ok) {
    throw new Error("Failed to get data from SmartLead");
  }
  const data = await response.json();
  return data;
}

export async function updateSmartLeadStatus(
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
