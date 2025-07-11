import Stripe from "stripe";
import {
  parseOrgIdString,
  getRecordIdFromRecord,
  updateCompany,
  request,                 
  getCompanyByRecordID  
} from "../../../lib/attio";

const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
if (!STRIPE_API_KEY) throw new Error("STRIPE_API_KEY env var missing");

const stripe = new Stripe(STRIPE_API_KEY, { apiVersion: "2025-06-30.basil" });

// Read orgId off the Stripe customer
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

// Find the Attio company by scanning its pipe-delimited org_id string (Name:id|Name2:id2|…)
async function findCompanyByOrgId(orgId: string): Promise<any | null> {
  const search: any = await request("POST", "/objects/companies/records/query", {
    attributes: ["org_id"],
  });

  for (const hit of search.data ?? []) {
    const raw = hit.values?.org_id ?? hit.data?.values?.org_id?.value ?? "";
    if (!raw) continue;

    const parsed = parseOrgIdString(raw);   
    if (parsed.some(org => org.id === orgId)) {
      const recId =
        hit.id?.record_id ||
        hit.data?.id?.record_id;
      if (recId) return getCompanyByRecordID(recId);
    }
  }
  return null;
}

// Credit the company
export async function updateCompanyCredits(
  orgId: string,
  amountCents: number,
  createdUnix: number
) {
  const companyRec = await findCompanyByOrgId(orgId);
  if (!companyRec) {
    throw new Error(`Attio company with orgId=${orgId} not found`);
  }

  const companyId = getRecordIdFromRecord(companyRec);
  const existing = companyRec.data.values.credits_bought?.value ?? 0;

  if (!companyId) {
    throw new Error(`No companyId found for orgId=${orgId}`);
  }
  return updateCompany(companyId, {
    creditsBought: existing + amountCents,
    lastCreditPurchase: new Date(createdUnix * 1000).toISOString(),
  });
}

// High-level tool that the agent calls
export async function recordStripeCharge(
  orgId: string,
  amountCents: number,
  createdUnix: number
) {
  return updateCompanyCredits(orgId, amountCents, createdUnix);
}
