import * as attio from "../../../lib/attio";
import { z } from "zod";

// --- Tool Definitions ---

export const toolMetadataList = [
  {
    name: "getPersonByEmail",
    description: "Get a person from Attio by their email",
    parameters: { email: "string" },
  },
  {
    name: "getCompanyByPersonEmail",
    description: "Get a company from Attio by the email of a person",
    parameters: { email: "string" },
  },
  {
    name: "getPersonByRecordID",
    description: "Get a person from Attio by their Attio record ID",
    parameters: { recordId: "string" },
  },
  {
    name: "assertPerson",
    description: "Assert a person in Attio",
    parameters: {
      firstName: "string?",
      lastName: "string?",
      email: "string",
      userId: "string?",
      accountCreationDate: "string?",
      leadSource: "string?",
    },
  },
  {
    name: "updateCompany",
    description: "Update a company in Attio",
    parameters: {
      companyId: "string",
      updateObject: {
        orgId: {
          id: "string?",
          name: "string?",
        },
        hasOnboarded: "boolean?",
        creditsBought: "number?",
        lastCreditPurchase: "string?",
        accountCreationDate: "string?",
      },
    },
  },
  {
    name: "pingSlack",
    description: "Ping the #yay Slack channel",
    parameters: {
      personToPing: "string",
      inbox: "string",
      fromEmail: "string",
    },
  },
  {
    name: "getLeadStatusByEmail",
    description: "Gets the lead status for a person from Smartlead",
    parameters: {
      email: "string",
    },
  },
];

// --- Tool Executors ---
export const toolExecutors: Record<string, Function> = {
  getPersonByEmail: async ({ email }: { email: string }) => {
    const person = await attio.getPersonByEmail(email);
    return person;
  },
  getCompanyByPersonEmail: async ({ email }: { email: string }) => {
    const company = await attio.getCompanyByPersonEmail(email);
    return company;
  },
  getPersonByRecordID: async ({ recordId }: { recordId: string }) => {
    return await attio.getPersonByRecordID(recordId);
  },
  assertPerson: async (personInfo: attio.PersonInfo) => {
    return await attio.assertPerson(personInfo);
  },
  updateCompany: async ({
    companyId,
    updateObject,
  }: {
    companyId: string;
    updateObject: attio.UpdateCompanyObject;
  }) => {
    return await attio.updateCompany(companyId, updateObject);
  },
  pingSlack: async ({
    personToPing,
    inbox,
    fromEmail,
  }: {
    personToPing: string;
    inbox: string;
    fromEmail: string;
  }) => {
    const webhookUrl = process.env.SLACK_WEBHOOK;
    if (!webhookUrl) {
      throw new Error("SLACK_WEBHOOK environment variable is not set");
    }
    const payload = {
      text: `<@U08RTB2438F You have an email to look at in your inbox: ${inbox} from ${fromEmail}`,
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
    return { ok: true };
  },
  getLeadStatusByEmail: async ({ email }: { email: string }) => {
    const smartlead_api_key = process.env.SMARTLEAD_API_KEY;
    if (!smartlead_api_key) {
      throw new Error("SMARTLEAD_API_KEY environment variable is not set");
    }
    const response = await fetch(
      `https://server.smartlead.ai/api/v1/leads/?api_key=${smartlead_api_key}&email=${email}`
    );
    const data = await response.json();
    return data;
  },
};
