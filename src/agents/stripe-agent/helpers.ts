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
  console.log("🔍  findCompanyByOrgId – searching for", orgId);

  // Ask Attio for *only* the org_id column so we don’t pull giant payloads back.
  const { data: rows = [] } = (await request(
    "POST","/objects/companies/records/query",
    { attributes: ["org_id"] },
  )) as { data?: any[] };

  console.log(`🔍  Scanning ${rows.length} companies from Attio…`);

  // Utility that checks whether one string cell contains the target orgId, "orgId=<id>" or "NameA:idA|NameB:idB"
  const cellMatches = (raw: string): boolean => {
    if (raw.startsWith("orgId=")) return raw.slice(6).trim() === orgId;
    return parseOrgIdString(raw).some(o => o.id === orgId);
  };

  for (const [index, row] of rows.entries()) {
    const recordId =
      row.id?.record_id ??
      row.data?.id?.record_id ??
      "<missing-record-id>";

    const cellValue =
      row.values?.org_id ??
      row.data?.values?.org_id?.value ??
      "";

    console.log(
      `[${index}] recordId=${recordId} rawOrgId=`,
      JSON.stringify(cellValue),
    );

    // Nothing stored, on to the next row
    if (!cellValue || (Array.isArray(cellValue) && cellValue.length === 0)) {
      continue;
    }

    // History array (newer Attio) 
    if (Array.isArray(cellValue)) {
      const hit = cellValue.find(v => cellMatches(String(v?.value ?? "")));
      if (hit) {
        console.log("✅  Match found inside history array ->", recordId);
        return getCompanyByRecordID(recordId);
      }
      continue; // no match in the history entries
    }

    // Single-string cell
    if (typeof cellValue === "string" && cellMatches(cellValue.trim())) {
      console.log("✅  Match found in single string ->", recordId);
      return getCompanyByRecordID(recordId);
    }
  }

  console.warn("⚠️  No company contains orgId", orgId);
  return null;
}

// Credit the company
export async function updateCompanyCredits(
  orgId: string,
  amountCents: number,
  createdUnix: number
) {
  const companyRec = await findCompanyByOrgId(orgId);
  if (!companyRec) throw new Error(`Attio company with orgId=${orgId} not found`);

  const companyId = getRecordIdFromRecord(companyRec);
  if (!companyId) throw new Error(`No companyId found for orgId=${orgId}`);

  const latest = (arr: any[]) => arr[arr.length - 1];

  const raw = companyRec.data.values?.credits_bought;   // ← correct slug

  const existing =
    Array.isArray(raw) ? Number(latest(raw)?.value ?? 0) : raw?.value ?? 0;

  return updateCompany(
    companyId, 
    {
      creditsBought : existing + amountCents,
      lastCreditPurchase : new Date(createdUnix * 1000).toISOString(),
    } as any 
  );
}

// High-level tool that the agent calls
export async function recordStripeCharge(
  orgId: string,
  amountCents: number,
  createdUnix: number
) {
  return updateCompanyCredits(orgId, amountCents, createdUnix);
}
