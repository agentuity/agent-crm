import * as attio from "../../../lib/attio";

// Tool metadata in JSON format for createAgent
export const toolMetadata = [
  {
    name: "getPersonByEmail",
    description: "Get a person by their email",
    parameters: {
      email: "string",
    },
  },
  {
    name: "getCompanyByPersonEmail",
    description: "Get a company by the email of a person",
    parameters: {
      email: "string",
    },
  },
  {
    name: "getPersonByClerkID",
    description: "Get a person by their Clerk ID",
    parameters: {
      clerkId: "string",
    },
  },
  {
    name: "getPersonByRecordID",
    description: "Get a person by their Attio record ID",
    parameters: {
      recordId: "string",
    },
  },
  {
    name: "assertPerson",
    description: "Assert a person in Attio",
    parameters: {
      firstName: "string?",
      lastName: "string?",
      email: "string",
      userId: "string?",
      accountCreationDate: "string?",
      leadSource: "string?",
    },
  },
  {
    name: "getCompanyByRecordID",
    description: "Get a company by their Attio record ID",
    parameters: {
      recordId: "string",
    },
  },
  {
    name: "updateCompany",
    description: "Update a company",
    parameters: {
      companyId: "string",
      updateObject: "object",
    },
  },
  {
    name: "addOrgToCompany",
    description: "Add an organization to a company's orgId field (handles string concatenation)",
    parameters: {
      companyId: "string",
      orgName: "string",
      orgId: "string",
    },
  },
  {
    name: "getCompaniesByOrgId",
    description: "Find all companies that contain a specific organization ID in their orgId field",
    parameters: {
      orgId: "string",
    },
  },
  {
    name: "updateOrgNameInCompany",
    description: "Update an organization's name in a company's orgId field based on org ID",
    parameters: {
      companyId: "string",
      orgId: "string",
      newOrgName: "string",
    },
  },
];


  export const toolExecutors: Record<string, Function> = {
    getPersonByEmail: async ({ email }: { email: string }) => {
      const person = await attio.getPersonByEmail(email);
      return person;
    },
    getCompanyByPersonEmail: async ({ email }: { email: string }) => {
      const company = await attio.getCompanyByPersonEmail(email);
      return company;
    },
    getPersonByClerkID: async ({ clerkId }: { clerkId: string }) => {
      return await attio.getPersonByClerkID(clerkId);
    },
    getPersonByRecordID: async ({ recordId }: { recordId: string }) => {
      return await attio.getPersonByRecordID(recordId);
    },
    assertPerson: async (personInfo: attio.PersonInfo) => {
      return await attio.assertPerson(personInfo);
    },
    getCompanyByRecordID: async ({ recordId }: { recordId: string }) => {
      return await attio.getCompanyByRecordID(recordId);
    },
    updateCompany: async ({
      companyId,
      updateObject,
    }: {
      companyId: string;
      updateObject: attio.UpdateCompanyObject;
    }) => {
      return await attio.updateCompany(companyId, updateObject);
    },
      addOrgToCompany: async ({
    companyId,
    orgName,
    orgId,
  }: {
    companyId: string;
    orgName: string;
    orgId: string;
  }) => {
    // First get the current company to check existing orgId
    const company = await attio.getCompanyByRecordID(companyId);
    // Extract the actual string value from Attio's attribute structure
    const currentOrgId = company?.data?.values?.org_id?.[0]?.value || null;
    
    // Add the new org to the string
    const updatedOrgId = attio.addOrgToOrgIdString(currentOrgId, orgName, orgId);
    
    // Update the company with the new orgId string
    const result = await attio.updateCompany(companyId, { orgId: updatedOrgId });
    
    return result;
  },
  getCompaniesByOrgId: async ({ orgId }: { orgId: string }) => {
    return await attio.getCompaniesByOrgId(orgId);
  },
  updateOrgNameInCompany: async ({
    companyId,
    orgId,
    newOrgName,
  }: {
    companyId: string;
    orgId: string;
    newOrgName: string;
  }) => {
    // First get the current company to check existing orgId
    const company = await attio.getCompanyByRecordID(companyId);
    // Extract the actual string value from Attio's attribute structure
    const currentOrgId = company?.data?.values?.org_id?.[0]?.value || null;
    
    // Update the org name in the string
    const updatedOrgId = attio.updateOrgNameInOrgIdString(currentOrgId, orgId, newOrgName);
    
    if (updatedOrgId === null) {
      throw new Error(`Organization with ID ${orgId} not found in company ${companyId}`);
    }
    
    // Update the company with the new orgId string
    const result = await attio.updateCompany(companyId, { orgId: updatedOrgId });
    
    return result;
  },
};