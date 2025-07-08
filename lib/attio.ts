const ATTIO_AUTH_TOKEN = process.env.ATTIO_AUTH_TOKEN;

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

export type OrgId = { id: string; name: string };

export type UpdateCompanyObject = {
  orgId?: OrgId;
  hasOnboarded?: boolean;
  creditsBought?: number;
  lastCreditPurchase?: string; // timestamp
  accountCreationDate?: string; // timestamp
};

// --- Utility/Helper Functions ---
export function getRecordIdFromRecord(record: any): string | null {
  return record?.data?.id?.record_id || null;
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
  return company;
}

export async function getCompanyByPersonEmail(email: string): Promise<any> {
  const person = await getPersonByEmail(email);
  console.log("Person object:", person);
  const companyId = person.data[0]?.values?.company[0]?.target_record_id;
  if (!companyId) {
    return null;
  }
  console.log("Extracted companyId:", companyId);
  const company = await getCompanyByRecordID(companyId);
  console.log("Company object:", company);
  return company;
}

export async function updateCompany(
  companyId: string,
  updateObject: UpdateCompanyObject
): Promise<any> {
  // Build values object dynamically, only including fields that exist
  const values: any = {};
  if (updateObject.orgId) {
    values.org_id = updateObject.orgId.id;
  }
  if (typeof updateObject.hasOnboarded === "boolean") {
    values.has_onboarded = updateObject.hasOnboarded;
  }
  if (typeof updateObject.creditsBought === "number") {
    values.credits_bought = updateObject.creditsBought;
  }
  if (updateObject.lastCreditPurchase) {
    values.last_credit_purchase = updateObject.lastCreditPurchase;
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

// // --- Main/Test Code ---
// await assertPerson({
//   email: "sue@gmail.com",
//   firstName: "Sue",
//   lastName: "Smith",
//   userId: "user_M4r2u8d1O2Aukv5bR6Fr5o8bR5F",
//   accountCreationDate: "2021-01-01T00:00:00Z",
//   leadSource: "Google",
// });

// const companyId = getRecordIdFromRecord(await getCompanyByPersonEmail("sue@gmail.com"));
// if (companyId) {
//   await updateCompany(companyId, {
//     creditsBought: 500,
//   });
// } else {
//   console.error("Company ID not found for sue@gmail.com");
// }
