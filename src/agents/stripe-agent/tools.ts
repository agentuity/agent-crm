import { z } from "zod";
import fromZodSchema from "zod-to-json-schema";

import {verifyStripeSignature} from "./verification"
import { getOrgIdFromCustomer, recordStripeCharge } from "./stripe_helpers";

// Tool metadata
export const toolMetadataList = [
  {
    name: "verifyStripeSignature",
    description:
      "Verify that the incoming webhook payload was genuinely sent by Stripe. Throws on failure.",
    parameters: fromZodSchema(
      z.object({
        rawBody: z.string().min(10, "raw JSON payload as-string"),
        sigHeader: z.string().min(10, "value from Stripe-Signature header"),
      })
    ),
  },
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
  verifyStripeSignature: async ({
    rawBody,
    sigHeader,
  }: {
    rawBody: string;
    sigHeader: string;
  }) => verifyStripeSignature(rawBody, sigHeader),

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