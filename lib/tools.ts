import { tool } from "ai";
import { z } from "zod";
import {
  addPerson,
  getPeople,
  updatePersonByEmail,
  getPersonByEmail,
} from "./db";

export const addPersonTool = tool({
  description: "Add a new person to the attio_mockup table.",
  parameters: z.object({
    name: z.string(),
    emailAddress: z.string().email(),
    firstEmailInteraction: z.coerce.date().optional(),
    lastEmailInteraction: z.coerce.date().optional(),
    firstCalendarInteraction: z.coerce.date().optional(),
    nextCalendarInteraction: z.coerce.date().optional(),
    lastCalendarInteraction: z.coerce.date().optional(),
  }),
  execute: async ({
    name,
    emailAddress,
    firstEmailInteraction,
    lastEmailInteraction,
    firstCalendarInteraction,
    nextCalendarInteraction,
    lastCalendarInteraction,
  }) => {
    await addPerson(
      name,
      emailAddress,
      firstEmailInteraction,
      lastEmailInteraction,
      firstCalendarInteraction,
      nextCalendarInteraction,
      lastCalendarInteraction
    );
    return { ok: true };
  },
});

export const getPeopleTool = tool({
  description: "Get a list of people from the attio_mockup table.",
  parameters: z.object({
    limit: z.number().int().min(1).max(100).optional(),
  }),
  execute: async ({ limit }) => {
    const people = await getPeople(limit);
    return { people };
  },
});

export const updatePersonByEmailTool = tool({
  description:
    "Update a person's details in the attio_mockup table by email address.",
  parameters: z.object({
    emailAddress: z.string().email(),
    name: z.string().optional(),
    firstEmailInteraction: z.coerce.date().nullable().optional(),
    lastEmailInteraction: z.coerce.date().nullable().optional(),
    firstCalendarInteraction: z.coerce.date().nullable().optional(),
    nextCalendarInteraction: z.coerce.date().nullable().optional(),
    lastCalendarInteraction: z.coerce.date().nullable().optional(),
  }),
  execute: async ({
    emailAddress,
    name,
    firstEmailInteraction,
    lastEmailInteraction,
    firstCalendarInteraction,
    nextCalendarInteraction,
    lastCalendarInteraction,
  }) => {
    await updatePersonByEmail(emailAddress, {
      name,
      firstEmailInteraction,
      lastEmailInteraction,
      firstCalendarInteraction,
      nextCalendarInteraction,
      lastCalendarInteraction,
    });
    return { ok: true };
  },
});

export const getPersonByEmailTool = tool({
  description:
    "Get a person's details from the attio_mockup table by email address.",
  parameters: z.object({
    emailAddress: z.string().email(),
  }),
  execute: async ({ emailAddress }) => {
    const person = await getPersonByEmail(emailAddress);
    return { person };
  },
});
