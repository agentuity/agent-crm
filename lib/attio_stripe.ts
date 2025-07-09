// lib/attio_stripe.ts
import {
    getPersonByEmail,
    getCompanyByPersonEmail,
    getRecordIdFromRecord,
    updateCompany,
  } from "./attio";
  
  // Push a Stripe purchase into Attio.
  // Adds amount (in cents) to creditsBought and sets lastCreditPurchase.
 
  export async function recordStripePurchase(
    email: string,
    amount: number,
    timestamp: number
  ) {
    // Ensure the buyer person exists (creates if needed, via existing helper)
    await getPersonByEmail(email);
  
    // Find company linked to that person
    const companyObj = await getCompanyByPersonEmail(email);
    const companyId = getRecordIdFromRecord(companyObj);
    if (!companyId) {
        throw new Error(`No company linked to ${email}`);
    }
  
    // Read current total credits (default 0)
    const currentTotal =
      companyObj.data.values.credits_bought?.value ?? 0;
  
    // Patch company
    return updateCompany(companyId, {
      creditsBought: currentTotal + amount,
      lastCreditPurchase: new Date(timestamp * 1000).toISOString(),
    });
  }
  