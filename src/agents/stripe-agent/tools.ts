// src/agents/stripe-agent/tools.ts
import { z } from "zod";
import { recordStripePurchase } from "../../../lib/attio_stripe";
import { getPersonByEmail } from "../../../lib/attio";
import fromZodSchema from "zod-to-json-schema";

// Tool metadata
export const toolMetadataList = [
  {
    name: "getPersonByEmail",
    description: "Lookup a person in Attio by email.",
    parameters: fromZodSchema(z.object({ email: z.string().email() })),
  },
  {
    name: "recordStripePurchase",
    description:
      "Increment company's creditsBought and set lastCreditPurchase.",
    parameters: fromZodSchema(
      z.object({
        email: z.string().email(),
        amount: z.number(),
        timestamp: z.number(),
      })
    ),
  },
];

// Tool executors
export const toolExecutors = {
  getPersonByEmail: async ({ email }: { email: string }) =>
    getPersonByEmail(email),

  recordStripePurchase: async ({
    email,
    amount,
    timestamp,
  }: {
    email: string;
    amount: number;
    timestamp: number;
  }) => recordStripePurchase(email, amount, timestamp),
};
