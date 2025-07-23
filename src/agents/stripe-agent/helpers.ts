import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_API_KEY ?? "", {
  apiVersion: "2025-06-30.basil",
});

//Read orgId off the Stripe customer
export async function getOrgIdFromCustomer(customerId: string): Promise<string> {
  const customer: any = await stripe.customers.retrieve(customerId);
  const orgId = (customer?.metadata as any)?.orgId;
  if (!orgId) {
    throw new Error(
      `metadata.orgId missing on Stripe customer ${customerId}.`
    );
  }
  return orgId.trim();
}

function extractAmount(raw: any): number {
  if (raw == null) return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw);

  if (typeof raw === "object") {
    if ("amount" in raw) return Number(raw.amount);
    if ("value" in raw) return Number(raw.value);
    if ("currency_value" in raw) return Number(raw.currency_value);
  }
  return 0;
}

export function latestAttioNumber(field: any,): number {
  if (!field) return 0;

  if (Array.isArray(field)) {
    const latest = field[field.length - 1];         
    return extractAmount(latest?.value ?? latest);
  }
  return extractAmount(field.value ?? field);
}

