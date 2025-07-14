import { z } from "zod";
import fromZodSchema from "zod-to-json-schema";

import { getOrgIdFromCustomer, recordStripeCharge } from "./helpers";

// Tool metadata
export const toolMetadataList = [
  {
    name: "getOrgIdFromCustomer",
    description:
      "Given a Stripe customer ID, fetch the customer via Stripe API and return metadata.orgId.",
    parameters: fromZodSchema(
      z.object({
        stripeCustomerId: z.string().startsWith("cus_"),
      })
    ),
  },
  {
    name: "recordStripeCharge",
    description:
      "Add the charge amount (in cents) to the company’s creditsBought and stamp lastCreditPurchase.",
    parameters: fromZodSchema(
      z.object({
        orgId: z.string().min(1),
        amount: z.number().int().positive(),
        timestamp: z.number().int().positive(), // unix seconds
      })
    ),
  },
];

// Tool executors
export const toolExecutors: Record<string, Function> = {

  getOrgIdFromCustomer: async ({
    stripeCustomerId,
  }: {
    stripeCustomerId: string;
  }) => getOrgIdFromCustomer(stripeCustomerId),

  recordStripeCharge: async ({
    orgId,
    amount,
    timestamp,
  }: {
    orgId: string;
    amount: number;
    timestamp: number;
  }) => recordStripeCharge(orgId, amount, timestamp),
};