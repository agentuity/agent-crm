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

    console.log(row);
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

function getCurrentValue(field: any): number {
  if (!field) return 0;

  if (Array.isArray(field)) {
    const latest = field[field.length - 1];         
    return extractAmount(latest?.value ?? latest);
  }
  return extractAmount(field.value ?? field);
}

export async function updateCompanyCredits(
  orgId: string,
  amountCents: number,
  _createdUnix?: number
) {
  const company = await findCompanyByOrgId(orgId);
  if (!company) throw new Error(`No company found for orgId=${orgId}`);

  const companyId = getRecordIdFromRecord(company);
  if (!companyId) throw new Error(`No companyId for orgId=${orgId}`);

  const currentRaw = company.data.values?.credits_bought;
  const existing = getCurrentValue(currentRaw);
  const newAmount = existing + (amountCents / 100);           
  const isoDate = new Date().toISOString();         

  console.log(`💳 Existing dollars: ${existing} → New dollars: ${newAmount}`);
  console.log(`🕒 Updating last purchase to: ${isoDate}`);

  return updateCompany(companyId, {
    creditsBought : newAmount,       
    lastCreditPurchase : isoDate,         
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
