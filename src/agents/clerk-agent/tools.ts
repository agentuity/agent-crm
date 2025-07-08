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
