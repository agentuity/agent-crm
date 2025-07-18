// import { parseOrgIdString, addOrgToOrgIdString, updateOrgNameInOrgIdString } from "../../../lib/helpers";

// // Custom tools in Anthropic format for clerk-agent
// // These handle business logic that composio's basic ATTIO tools don't cover
// export const clerkExtraTools = [
//   {
//     name: "addOrgToCompany",
//     description: "Add an organization to a company's orgId field using the pipe-delimited format (Name:id|Name2:id2). Automatically handles duplicate prevention.",
//     input_schema: {
//       type: "object",
//       properties: {
//         companyId: {
//           type: "string",
//           description: "The Attio record ID of the company"
//         },
//         orgName: {
//           type: "string", 
//           description: "The name of the organization to add"
//         },
//         orgId: {
//           type: "string",
//           description: "The Clerk organization ID"
//         }
//       },
//       required: ["companyId", "orgName", "orgId"]
//     }
//   },
//   {
//     name: "getCompaniesByOrgId", 
//     description: "Find all companies that contain a specific organization ID in their orgId field",
//     input_schema: {
//       type: "object",
//       properties: {
//         orgId: {
//           type: "string",
//           description: "The organization ID to search for"
//         }
//       },
//       required: ["orgId"]
//     }
//   },
//   {
//     name: "updateOrgNameInCompany",
//     description: "Update an organization's name in a company's orgId field based on org ID", 
//     input_schema: {
//       type: "object",
//       properties: {
//         companyId: {
//           type: "string",
//           description: "The Attio record ID of the company"
//         },
//         orgId: {
//           type: "string", 
//           description: "The organization ID to update"
//         },
//         newOrgName: {
//           type: "string",
//           description: "The new organization name"
//         }
//       },
//       required: ["companyId", "orgId", "newOrgName"]
//     }
//   }
// ];

// // Tool executors for the custom tools
// // These will be called by composio when the tools are invoked
// export const clerkToolExecutors: Record<string, Function> = {
//   addOrgToCompany: async ({
//     companyId,
//     orgName,
//     orgId,
//   }: {
//     companyId: string;
//     orgName: string;
//     orgId: string;
//   }) => {
//     // This function will be called by composio, so we need to make direct API calls
//     // First get the current company to check existing orgId
//     const response = await fetch(`https://api.attio.com/v2/objects/companies/records/${companyId}`, {
//       method: "GET",
//       headers: {
//         Authorization: `Bearer ${process.env.ATTIO_AUTH_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//     });
    
//     if (!response.ok) {
//       throw new Error(`Failed to get company: ${response.status}`);
//     }
    
//     const company = await response.json() as any;
    
//     // Extract the actual string value from Attio's attribute structure
//     const currentOrgId = company?.data?.values?.org_id?.[0]?.value || null;
    
//     // Add the new org to the string using our helper
//     const updatedOrgId = addOrgToOrgIdString(currentOrgId, orgName, orgId);
    
//     // Update the company with the new orgId string
//     const updateResponse = await fetch(`https://api.attio.com/v2/objects/companies/records/${companyId}`, {
//       method: "PATCH",
//       headers: {
//         Authorization: `Bearer ${process.env.ATTIO_AUTH_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         data: {
//           values: {
//             org_id: updatedOrgId
//           }
//         }
//       })
//     });
    
//     if (!updateResponse.ok) {
//       throw new Error(`Failed to update company: ${updateResponse.status}`);
//     }
    
//     return await updateResponse.json();
//   },

//   getCompaniesByOrgId: async ({ orgId }: { orgId: string }) => {
//     // Get all companies since Attio doesn't support substring search on orgId field
//     const response = await fetch("https://api.attio.com/v2/objects/companies/records/query", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.ATTIO_AUTH_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({}) // No filter to get all companies
//     });

//     if (!response.ok) {
//       throw new Error(`Failed to query companies: ${response.status}`);
//     }

//     const search = await response.json() as any;
    
//     if (!search?.data) return [];

//     // Filter companies that have the orgId in their concatenated orgId string
//     const matchingCompanies = search.data.filter((company: any) => {
//       const orgIdValue = company?.values?.org_id?.[0]?.value;
//       if (!orgIdValue || typeof orgIdValue !== 'string') return false;
      
//       // Parse the orgId string and check if any org has the target ID
//       const orgs = parseOrgIdString(orgIdValue);
//       return orgs.some(org => org.id === orgId);
//     });

//     // Return full company records
//     const results = [];
//     for (const company of matchingCompanies) {
//       const recordId = company.id?.record_id;
//       if (recordId) {
//         const fullCompanyResponse = await fetch(`https://api.attio.com/v2/objects/companies/records/${recordId}`, {
//           method: "GET",
//           headers: {
//             Authorization: `Bearer ${process.env.ATTIO_AUTH_TOKEN}`,
//             "Content-Type": "application/json",
//           },
//         });
        
//         if (fullCompanyResponse.ok) {
//           const fullCompany = await fullCompanyResponse.json();
//           results.push(fullCompany);
//         }
//       }
//     }

//     return results;
//   },

//   updateOrgNameInCompany: async ({
//     companyId,
//     orgId,
//     newOrgName,
//   }: {
//     companyId: string;
//     orgId: string;
//     newOrgName: string;
//   }) => {
//     // First get the current company to check existing orgId
//     const response = await fetch(`https://api.attio.com/v2/objects/companies/records/${companyId}`, {
//       method: "GET",
//       headers: {
//         Authorization: `Bearer ${process.env.ATTIO_AUTH_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//     });
    
//     if (!response.ok) {
//       throw new Error(`Failed to get company: ${response.status}`);
//     }
    
//     const company = await response.json() as any;
    
//     // Extract the actual string value from Attio's attribute structure
//     const currentOrgId = company?.data?.values?.org_id?.[0]?.value || null;
    
//     // Update the org name in the string using our helper
//     const updatedOrgId = updateOrgNameInOrgIdString(currentOrgId, orgId, newOrgName);
    
//     if (updatedOrgId === null) {
//       throw new Error(`Organization with ID ${orgId} not found in company ${companyId}`);
//     }
    
//     // Update the company with the new orgId string
//     const updateResponse = await fetch(`https://api.attio.com/v2/objects/companies/records/${companyId}`, {
//       method: "PATCH",
//       headers: {
//         Authorization: `Bearer ${process.env.ATTIO_AUTH_TOKEN}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         data: {
//           values: {
//             org_id: updatedOrgId
//           }
//         }
//       })
//     });
    
//     if (!updateResponse.ok) {
//       throw new Error(`Failed to update company: ${updateResponse.status}`);
//     }
    
//     return await updateResponse.json();
//   },
// };