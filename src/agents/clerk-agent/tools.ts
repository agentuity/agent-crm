import * as attio from "../../../lib/attio";
import { z } from "zod";

// Tool metadata in JSON format for createAgent
export const toolMetadata = [
  {
    name: "getPersonByEmail",
    description: "Get a person by their email",
    parameters: {
      email: "string",
    },
  },
  {
    name: "getCompanyByPersonEmail",
    description: "Get a company by the email of a person",
    parameters: {
      email: "string",
    },
  },
  {
    name: "getPersonByClerkID",
    description: "Get a person by their Clerk ID",
    parameters: {
      clerkId: "string",
    },
  },
  {
    name: "getPersonByRecordID",
    description: "Get a person by their Attio record ID",
    parameters: {
      recordId: "string",
    },
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
    name: "getCompanyByRecordID",
    description: "Get a company by their Attio record ID",
    parameters: {
      recordId: "string",
    },
  },
  {
    name: "updateCompany",
    description: "Update a company",
    parameters: {
      companyId: "string",
      updateObject: "object",
    },
  },
];

// Original zod-based tools (kept for reference/validation if needed)
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