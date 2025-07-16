const ATTIO_AUTH_TOKEN = process.env.ATTIO_AUTH_TOKEN;

import { parseOrgIdString, formatOrgIdString, addOrgToOrgIdString, updateOrgNameInOrgIdString } from './helpers';

// Re-export helper functions for backwards compatibility
export { parseOrgIdString, formatOrgIdString, addOrgToOrgIdString, updateOrgNameInOrgIdString };

export async function request(method: string, path: string, body?: any) {
  const url = `https://api.attio.com/v2${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${ATTIO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Attio ${method} ${path} -> ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json;
}

// --- Type Definitions ---
export type PersonInfo = {
  firstName?: string;
  lastName?: string;
  email: string;
  userId?: string;
  accountCreationDate?: string; // ISO string or timestamp
  leadSource?: string;
};

export type UpdateCompanyObject = {
  orgId?: string; // Changed from OrgId object to string format: "Name:id|Name2:id2"

  hasOnboarded?: boolean;
  creditsBought?: number;
  lastCreditPurchase?: string; // timestamp
  accountCreationDate?: string; // timestamp
};

// --- Utility/Helper Functions ---

export function getRecordIdFromRecord(record: any): string | null {
  return record?.data?.id?.record_id || null;
}

export function getRecordIdFromCompany(company: any): string | null {
  return company?.data?.id?.record_id || null;
}

export function getRecordIdFromPerson(person: any): string | null {
  return person?.data[0]?.id?.record_id || null;
}

// --- Person-related Functions ---
export async function assertPerson(personInfo: PersonInfo): Promise<any> {
  // Always include email_addresses
  const values: any = {
    email_addresses: [
      {
        email_address: personInfo.email,
      },
    ],
  };
  // Conditionally add name if present
  if (personInfo.firstName || personInfo.lastName) {
    values.name = {
      ...(personInfo.firstName && { first_name: personInfo.firstName }),
      ...(personInfo.lastName && { last_name: personInfo.lastName }),
      ...(personInfo.firstName &&
        personInfo.lastName && {
          full_name: `${personInfo.firstName} ${personInfo.lastName}`,
        }),
    };
  }
  if (personInfo.userId) {
    values.user_id = personInfo.userId;
  }
  if (personInfo.accountCreationDate) {
    values.account_creation_date = personInfo.accountCreationDate;
  }
  if (personInfo.leadSource) {
    values.lead_source = personInfo.leadSource;
  }
  const body = {
    data: {
      values,
    },
  };
  return await request(
    "PUT",
    `/objects/people/records?matching_attribute=email_addresses`,
    body
  );
}

export async function getPersonByEmail(email: string): Promise<any> {
  const body = {
    filter: {
      email_addresses: email,
    },
  };
  return await request("POST", "/objects/people/records/query", body);
}

export async function getPersonByClerkID(clerkId: string): Promise<any> {
  // Assuming you have a custom attribute for Clerk ID
  const body = {
    filter: {
      user_id: clerkId, // This should be the actual attribute slug for Clerk ID
    },
  };
  return await request("POST", "/objects/people/records/query", body);
}

export async function getPersonByRecordID(recordId: string): Promise<any> {
  const person = await request("GET", `/objects/people/records/${recordId}`);
  return person;
}

// --- Company-related Functions ---
export async function getCompanyByRecordID(recordId: string): Promise<any> {
  const company = await request(
    "GET",
    `/objects/companies/records/${recordId}`
  );
  console.log(company);
  return company;
}

export async function getCompanyByPersonEmail(email: string): Promise<any> {
  const person = await getPersonByEmail(email);
  
  // Debug logging to understand the person structure
  console.log('Person data for email:', email);
  console.log('Full person response:', JSON.stringify(person, null, 2));
  
  if (!person?.data || !Array.isArray(person.data) || person.data.length === 0) {
    console.log('No person data found for email:', email);
    return null;
  }
  
  const personRecord = person.data[0];
  console.log('Person record:', JSON.stringify(personRecord, null, 2));
  
  const companyValue = personRecord?.values?.company;
  console.log('Company value:', JSON.stringify(companyValue, null, 2));
  
  if (!companyValue || !Array.isArray(companyValue) || companyValue.length === 0) {
    console.log('No company association found for person with email:', email);
    return null;
  }
  
  const companyId = companyValue[0]?.target_record_id;
  console.log('Extracted company ID:', companyId);
  
  if (!companyId || typeof companyId !== 'string') {
    console.log('Invalid or missing company record ID for email:', email);
    return null;
  }
  
  // Validate that the companyId looks like a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(companyId)) {
    console.log('Company ID is not a valid UUID:', companyId);
    return null;
  }
  
  const company = await getCompanyByRecordID(companyId);
  return company;
}

export async function updateCompany(
  companyId: string,
  updateObject: UpdateCompanyObject
): Promise<any> {
  // Build values object dynamically, only including fields that exist
  const values: any = {};
  if (updateObject.orgId) {
    values.org_id = updateObject.orgId;
  }
  if (typeof updateObject.hasOnboarded === "boolean") {
    values.has_onboarded = updateObject.hasOnboarded;
  }
  if (typeof updateObject.creditsBought === "number") {
    values.credits_bought = updateObject.creditsBought;
  }
  if (updateObject.lastCreditPurchase) {
    values.last_credit_purchase_3 = updateObject.lastCreditPurchase;
  }
  if (updateObject.accountCreationDate) {
    values.account_creation_date = updateObject.accountCreationDate;
  }
  const body = {
    data: {
      values,
    },
  };
  return await request(
    "PATCH",
    `/objects/companies/records/${companyId}`,
    body
  );
}

// --- Deal-related Functions ---
/**
 * Skeleton: Find a deal by company record ID. Returns the first matching deal or null.
 */
export async function getDealByCompanyRecordId(
  companyRecordId: string
): Promise<any> {
  const body = {
    filter: {
      associated_company: {
        target_record_id: companyRecordId,
      },
    },
  };
  return await request("POST", "/objects/deals/records/query", body);
}

export async function assertCompanyInPipeline(
  companyRecordId: string,
  personRecordId: string,
  companyName: string
): Promise<any> {
  // First, try to find an existing deal for this company
  const existingDeal = await getDealByCompanyRecordId(companyRecordId);
  console.log("existingDeal:", existingDeal);
  if (existingDeal.data.length > 0) {
    // If a deal exists, add the person to associated_people (if not already present)
    const dealId = existingDeal.data[0]?.id?.record_id;
    const currentPeople = existingDeal.data[0]?.values?.associated_people || [];
    // Extract just the record IDs
    const currentPeopleIds = currentPeople
      .map((p: any) => (typeof p === "string" ? p : p?.target_record_id))
      .filter(Boolean);

    if (!currentPeopleIds.includes(personRecordId)) {
      const updatedPeople = [...currentPeopleIds, personRecordId];
      const body = {
        data: {
          values: {
            associated_people: updatedPeople,
          },
        },
      };
      return await request("PATCH", `/objects/deals/records/${dealId}`, body);
    } else {
      // Person already associated, nothing to do
      return existingDeal;
    }
  } else {
    // No deal exists, create a new one
    const body = {
      data: {
        values: {
          name: `Deal with ${companyName}`,
          stage: "Lead",
          owner: "nmirigliani@agentuity.com",
          value: 0,
          associated_people: [personRecordId],
          associated_company: companyRecordId,
        },
      },
    };
    return await request("POST", "/objects/deals/records", body);
  }
}

export async function getCompanyByOrgId(orgId: string): Promise<any | null> {
  // Search the Companies object with a simple filter
  const queryBody = {
    filter: { org_id: orgId },
  };

  const search: any = await request(
    "POST",
    "/objects/companies/records/query",
    queryBody
  );

  const hit = search?.data?.[0];
  if (!hit) return null;

  // Fetch the complete record so callers get the same shape as getCompanyByRecordID
  const recordId = hit.id?.record_id ?? hit.data?.id?.record_id;
  if (!recordId) return null;

  return await getCompanyByRecordID(recordId);
}

export async function getCompaniesByOrgId(orgId: string): Promise<any[]> {
  // Get all companies since Attio doesn't support substring search on orgId field
  const queryBody = {}; // No filter to get all companies

  const search: any = await request(
    "POST",
    "/objects/companies/records/query",
    queryBody
  );

  if (!search?.data) return [];

  // Filter companies that have the orgId in their concatenated orgId string
  const matchingCompanies = search.data.filter((company: any) => {
    const orgIdValue = company?.values?.org_id?.[0]?.value;
    if (!orgIdValue || typeof orgIdValue !== 'string') return false;
    
    // Parse the orgId string and check if any org has the target ID
    const orgs = parseOrgIdString(orgIdValue);
    return orgs.some(org => org.id === orgId);
  });

  // Return full company records
  const results = [];
  for (const company of matchingCompanies) {
    const recordId = company.id?.record_id;
    if (recordId) {
      const fullCompany = await getCompanyByRecordID(recordId);
      results.push(fullCompany);
    }
  }

  return results;
}
