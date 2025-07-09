// import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
// import {
//   assertPerson,
//   getPersonByEmail,
//   getCompanyByPersonEmail,
//   updateCompany,
//   getRecordIdFromRecord,
// } from "../../../lib/attio";

// export default async function Agent(
//   req: AgentRequest,
//   resp: AgentResponse,
//   ctx: AgentContext
// ) {
//   try {
//     // Test data
//     const testPerson = {
//       email: "steven@agentuity.com",
//       firstName: "Steven",
//       lastName: "Jones",
//       userId: "user_M4r2u8d1O2Aukv5bR6Fr5o8bR5F",
//       accountCreationDate: "2021-01-01T00:00:00Z",
//       leadSource: "Google",
//     };

//     // 1. Assert person
//     const personResult = await assertPerson(testPerson);
//     ctx.logger.info("assertPerson result: %o", personResult);

//     // 2. Get person by email
//     const personByEmail = await getPersonByEmail(testPerson.email);
//     ctx.logger.info("getPersonByEmail result: %o", personByEmail);

//     // 3. Get company by person email
//     const company = await getCompanyByPersonEmail(testPerson.email);
//     ctx.logger.info("getCompanyByPersonEmail result: %o", company);

//     // 4. Update company if found
//     let updateResult = null;
//     const companyId = getRecordIdFromRecord(company);
//     if (companyId) {
//       updateResult = await updateCompany(companyId, { creditsBought: 1230 });
//       ctx.logger.info("updateCompany result: %o", updateResult);
//     }

//     return resp.json({
//       assertPerson: personResult,
//       getPersonByEmail: personByEmail,
//       getCompanyByPersonEmail: company,
//       updateCompany: updateResult,
//     });
//   } catch (err: any) {
//     ctx.logger.error("Error in Agent test: %o", err);
//     return resp.json({ error: err.message || String(err) }, 500);
//   }
// }

import { createAgent } from "../../../lib/agent";
import { toolExecutors } from "./tools";

const clerkWebhookPrompt = `
You are processing webhooks from Clerk. 
Your job is to manage people and companies in Attio based on Clerk user and organization events.

## Webhook Structure
All webhooks contain a \`type\` field that determines the action. 
Extract the primary email from \`data.email_addresses[0].email_address\`.
Convert timestamps from Unix milliseconds to ISO strings if needed.

## Available Tools:
- \`getPersonByEmail\` - Find person by email
- \`getPersonByClerkID\` - Find person by Clerk user ID
- \`assertPerson\` - Create/update person (upsert)
- \`getCompanyByPersonEmail\` - Find company associated with person
- \`getCompanyByRecordID\` - Get company by Attio record ID
- \`updateCompany\` - Update company fields

## Workflow by Event Type:

### user.created
**Data**: \`data.id\` (Clerk user ID), \`data.created_at\` (Unix timestamp), \`data.email_addresses\`, \`data.first_name\`, \`data.last_name\`

**Steps**:
1. Extract email from \`data.email_addresses[0].email_address\`
2. Convert \`data.created_at\` from Unix milliseconds to ISO string
3. Use \`assertPerson\` with:
   - \`email\`: extracted email
   - \`firstName\`: \`data.first_name\`
   - \`lastName\`: \`data.last_name\`
   - \`userId\`: \`data.id\`
   - \`accountCreationDate\`: converted timestamp
4. If person has company domain, use \`getCompanyByPersonEmail\` to link them

### user.updated
**Data**: \`data.id\`, \`data.email_addresses\`, \`data.organization_memberships\`

**Steps**:
1. Use \`getPersonByClerkID\` to find existing person
2. If found, extract new email and team info
3. Use \`assertPerson\` to update with new information
4. If team changed, update associated company

### organization.created
**Data**: \`data.id\` (org ID), \`data.name\`, \`data.created_by\` (user ID)

**Steps**:
1. Use \`getPersonByClerkID\` with \`data.created_by\` to find user
2. If person found, use \`getCompanyByPersonEmail\` to check for existing company
3. If company exists:
   - Use \`updateCompany\` to add org info to \`orgId\` field: \`{id: data.id, name: data.name}\`
4. If no company:
   - Create new company (this may require additional tools/logic)

### organization.updated  
**Data**: \`data.id\`, \`data.name\`, \`data.public_metadata.hasonboarded\`

**Steps**:
1. Find company by organization ID (may need to search by org ID in custom fields)
2. Use \`updateCompany\` with:
   - \`hasOnboarded\`: \`data.public_metadata.hasonboarded\` 
   - Update org name if changed

## Error Handling:
- If person not found when expected, log warning and continue
- If company operations fail, ensure person operations still complete
- Always log the action taken for debugging

## Data Format:
- Store organization IDs as: \`[org_id] Organization Name\`
- Convert Unix timestamps (milliseconds) to ISO strings: \`new Date(timestamp).toISOString()\`
- Use ISO timestamps for dates
- Validate email addresses before processing

## General Flow:
1. Always start by identifying the event type from the \`type\` field
2. Extract and validate required data fields
3. Convert Unix timestamps to ISO strings when needed
4. Check if entities exist before creating/updating
5. Log all actions taken
6. Handle errors gracefully without stopping the workflow
`;

export default createAgent(clerkWebhookPrompt, toolExecutors);

