import * as attio from "../../../lib/attio";
import { z } from "zod";

// --- Tool Definitions ---

// export const tools = [
//   {
//     name: "getPersonByEmail",
//     description: "Get a person from Attio by their email",
//     parameters: z.object({ email: z.string() }),
//   },
//   {
//     name: "getCompanyByPersonEmail",
//     description: "Get a company from Attio by the email of a person",
//     parameters: z.object({ email: z.string() }),
//   },
//   {
//     name: "getPersonByRecordID",
//     description: "Get a person from Attio by their Attio record ID",
//     parameters: z.object({ recordId: z.string() }),
//   },
//   {
//     name: "assertPerson",
//     description: "Assert a person in Attio",
//     parameters: z.object({
//       firstName: z.string().optional(),
//       lastName: z.string().optional(),
//       email: z.string(),
//       userId: z.string().optional(),
//       accountCreationDate: z.string().optional(),
//       leadSource: z.string().optional(),
//     }),
//   },
//   {
//     name: "updateCompany",
//     description: "Update a company in Attio",
//     parameters: z.object({
//       companyId: z.string(),
//       updateObject: z.object({
//         orgId: z.object({ id: z.string(), name: z.string() }).optional(),
//         hasOnboarded: z.boolean().optional(),
//         creditsBought: z.number().optional(),
//         lastCreditPurchase: z.string().optional(),
//         accountCreationDate: z.string().optional(),
//       }),
//     }),
//   },
//   {
//     name: "pingSlack",
//     description: "Ping the #yay Slack channel",
//     parameters: z.object({
//       personToPing: z.string(),
//       inbox: z.string(),
//       fromEmail: z.string(),
//     }),
//   },
// ];

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
};
