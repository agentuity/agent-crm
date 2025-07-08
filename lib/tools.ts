import { z } from "zod";
import {
  addPerson,
  getPeople,
  updatePersonByEmail,
  getPersonByEmail,
} from "./attio";
import fromZodSchema from "zod-to-json-schema";

// Tool metadata for LLM reasoning
export const toolMetadataList = [
  {
    name: "addPerson",
    description: "Add a new person to the attio_mockup table.",
    parameters: fromZodSchema(
      z.object({
        name: z.string(),
        emailAddress: z.string().email(),
        firstEmailInteraction: z.coerce.date().optional(),
        lastEmailInteraction: z.coerce.date().optional(),
        firstCalendarInteraction: z.coerce.date().optional(),
        nextCalendarInteraction: z.coerce.date().optional(),
        lastCalendarInteraction: z.coerce.date().optional(),
      })
    ),
  },
  {
    name: "getPeople",
    description: "Get a list of people from the attio_mockup table.",
    parameters: fromZodSchema(
      z.object({
        limit: z.number().int().min(1).max(100).optional(),
      })
    ),
  },
  {
    name: "updatePersonByEmail",
    description:
      "Update a person's details in the attio_mockup table by email address.",
    parameters: fromZodSchema(
      z.object({
        emailAddress: z.string().email(),
        name: z.string().optional(),
        firstEmailInteraction: z.coerce.date().nullable().optional(),
        lastEmailInteraction: z.coerce.date().nullable().optional(),
        firstCalendarInteraction: z.coerce.date().nullable().optional(),
        nextCalendarInteraction: z.coerce.date().nullable().optional(),
        lastCalendarInteraction: z.coerce.date().nullable().optional(),
      })
    ),
  },
  {
    name: "getPersonByEmail",
    description:
      "Get a person's details from the attio_mockup table by email address.",
    parameters: fromZodSchema(
      z.object({
        emailAddress: z.string().email(),
      })
    ),
  },
];

// Tool executors for actual execution
export const toolExecutors: Record<string, Function> = {
  addPerson: async ({
    name,
    emailAddress,
    firstEmailInteraction,
    lastEmailInteraction,
    firstCalendarInteraction,
    nextCalendarInteraction,
    lastCalendarInteraction,
  }: {
    name: string;
    emailAddress: string;
    firstEmailInteraction?: Date;
    lastEmailInteraction?: Date;
    firstCalendarInteraction?: Date;
    nextCalendarInteraction?: Date;
    lastCalendarInteraction?: Date;
  }) => {
    return addPerson(
      name,
      emailAddress,
      firstEmailInteraction,
      lastEmailInteraction,
      firstCalendarInteraction,
      nextCalendarInteraction,
      lastCalendarInteraction
    );
  },
  getPeople: async ({ limit }: { limit?: number }) => getPeople(limit),
  updatePersonByEmail: async ({
    emailAddress,
    name,
    firstEmailInteraction,
    lastEmailInteraction,
    firstCalendarInteraction,
    nextCalendarInteraction,
    lastCalendarInteraction,
  }: {
    emailAddress: string;
    name?: string;
    firstEmailInteraction?: Date | null;
    lastEmailInteraction?: Date | null;
    firstCalendarInteraction?: Date | null;
    nextCalendarInteraction?: Date | null;
    lastCalendarInteraction?: Date | null;
  }) => {
    return updatePersonByEmail(emailAddress, {
      name,
      firstEmailInteraction,
      lastEmailInteraction,
      firstCalendarInteraction,
      nextCalendarInteraction,
      lastCalendarInteraction,
    });
  },
  getPersonByEmail: async ({ emailAddress }: { emailAddress: string }) =>
    getPersonByEmail(emailAddress),
};
