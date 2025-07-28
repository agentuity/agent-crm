import type { AgentContext } from "@agentuity/sdk";
import { latestAttioNumber, getOrgIdFromCustomer } from "./helpers";

// Tool metadata
export const toolMetadataList = [
  {
    name: "getOrgIdFromCustomer",
    description: "Fetch a Stripe customer and return `metadata.orgId`.",
    input_schema: {
      type: "object",
      properties: {
        customerId: {
          type: "string",
          description: 'The Stripe customer ID (begins with "cus_").',
          title: "Stripe Customer ID",
          examples: ["cus_K9q0xABC1234"],
        },
      },
      required: ["customerId"],
      title: "GetOrgIdFromCustomerRequest",
    },
    cache_control: undefined,
  },
  {
    name: "latestAttioNumber",
    description:
      "Return the latest numeric value from an Attio scalar or history-array field.",
    input_schema: {
      type: "object",
      properties: {
        field: {
          description:
            "Raw Attio field value (scalar number | string | history-array entry).",
          title: "Attio Field",
        },
      },
      required: ["field"],
      title: "LatestAttioNumberRequest",
    },
    cache_control: undefined,
  },
];

// Tool executors
export const toolExecutors: Record<string, (...args: any) => any> = {
  getOrgIdFromCustomer: async (
    {
      customerId,
    }: {
      customerId: string;
    },
    ctx: AgentContext
  ) => getOrgIdFromCustomer(customerId),

  latestAttioNumber: async (
    {
      field,
    }: {
      field: any;
    },
    ctx: AgentContext
  ) => latestAttioNumber(field),
};
