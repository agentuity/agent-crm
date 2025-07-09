// import { z } from "zod";
// import {
//   addPerson,
//   getPersonIDByEmail,
//   getPersonByID,
//   getCompanyIDByPersonID,
//   getCompanyByID,
//   updateCompanyByID,
// } from "../../../lib/attio";
// import fromZodSchema from "zod-to-json-schema";

// // Tool metadata
// export const toolMetadataList = [
//   {
//     name: "addPerson",
//     description: "Create a person with Clerk user info.",
//     parameters: fromZodSchema(
//       z.object({
//         firstName: z.string(),
//         lastName: z.string(),
//         email: z.string().email(),
//         userId: z.string(),
//         accountCreationDate: z.coerce.date(),
//       })
//     ),
//   },
//   {
//     name: "getPersonIDByEmail",
//     description: "Return personId for the given email.",
//     parameters: fromZodSchema(z.object({ email: z.string().email() })),
//   },
//   {
//     name: "getPersonByID",
//     description: "Fetch full person record by personId.",
//     parameters: fromZodSchema(z.object({ personId: z.string() })),
//   },
//   {
//     name: "getCompanyIDByPersonID",
//     description: "Find company linked to a personId.",
//     parameters: fromZodSchema(z.object({ personId: z.string() })),
//   },
//   {
//     name: "getCompanyByID",
//     description: "Fetch company record by companyId.",
//     parameters: fromZodSchema(z.object({ companyId: z.string() })),
//   },
//   {
//     name: "updateCompanyByID",
//     description: "Patch company fields (orgIds, onboarding, credits).",
//     parameters: fromZodSchema(
//       z.object({
//         companyId: z.string(),
//         orgIds: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
//         hasOnboarded: z.boolean().optional(),
//         totalCreditsBought: z.number().optional(),
//         lastCreditsBought: z.coerce.date().optional(),
//         accountCreationDate: z.coerce.date().optional(),
//       })
//     ),
//   },
// ];

// // Tool executors
// export const toolExecutors: Record<string, Function> = {
//   addPerson: async (p: {
//     firstName: string;
//     lastName: string;
//     email: string;
//     userId: string;
//     accountCreationDate: Date;
//   }) => addPerson(p),
//   getPersonIDByEmail: async ({ email }: { email: string }) =>
//     getPersonIDByEmail(email),
//   getPersonByID: async ({ personId }: { personId: string }) =>
//     getPersonByID(personId),
//   getCompanyIDByPersonID: async ({ personId }: { personId: string }) =>
//     getCompanyIDByPersonID(personId),
//   getCompanyByID: async ({ companyId }: { companyId: string }) =>
//     getCompanyByID(companyId),
//   updateCompanyByID: async ({
//     companyId,
//     ...rest
//   }: {
//     companyId: string;
//     orgIds?: { id: string; name: string }[];
//     hasOnboarded?: boolean;
//     totalCreditsBought?: number;
//     lastCreditsBought?: Date;
//     accountCreationDate?: Date;
//   }) => updateCompanyByID(companyId, rest),
// };


import * as attio from "../../../lib/attio";
import { z } from "zod";

export const tools = [
    {
      name: "getPersonByEmail",
      description: "Get a person by their email",
      parameters: z.object({ email: z.string() }),
    },
    {
      name: "getCompanyByPersonEmail",
      description: "Get a company by the email of a person",
      parameters: z.object({ email: z.string() }),
    },
    {
      name: "getPersonByClerkID",
      description: "Get a person by their Clerk ID",
      parameters: z.object({ clerkId: z.string() }),
    },
    {
      name: "getPersonByRecordID",
      description: "Get a person by their Attio record ID",
      parameters: z.object({ recordId: z.string() }),
    },
    {
      name: "assertPerson",
      description: "Assert a person",
      parameters: z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string(),
        userId: z.string().optional(),
        accountCreationDate: z.string().optional(),
        leadSource: z.string().optional(),
      }),
    },
    {
      name: "getCompanyByRecordID",
      description: "Get a company by their Attio record ID",
      parameters: z.object({ recordId: z.string() }),
    },
    {
      name: "updateCompany",
      description: "Update a company",
      parameters: z.object({
        companyId: z.string(),
        updateObject: z.object({
          orgId: z.object({ id: z.string(), name: z.string() }).optional(),
          hasOnboarded: z.boolean().optional(),
          creditsBought: z.number().optional(),
          lastCreditPurchase: z.string().optional(),
          accountCreationDate: z.string().optional(),
        }),
      }),
    },
  ];

  export const toolExecutors: Record<string, Function> = {
    getPersonByEmail: async ({ email }: { email: string }) => {
      const person = await attio.getPersonByEmail(email);
      return person;
    },
    getCompanyByPersonEmail: async ({ email }: { email: string }) => {
      const company = await attio.getCompanyByPersonEmail(email);
      return company;
    },
    getPersonByClerkID: async ({ clerkId }: { clerkId: string }) => {
      return await attio.getPersonByClerkID(clerkId);
    },
    getPersonByRecordID: async ({ recordId }: { recordId: string }) => {
      return await attio.getPersonByRecordID(recordId);
    },
    assertPerson: async (personInfo: attio.PersonInfo) => {
      return await attio.assertPerson(personInfo);
    },
    getCompanyByRecordID: async ({ recordId }: { recordId: string }) => {
      return await attio.getCompanyByRecordID(recordId);
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
  };