import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import {
  assertPerson,
  getPersonByEmail,
  getCompanyByPersonEmail,
  updateCompany,
  getRecordIdFromRecord,
} from "../../../lib/attio";

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  try {
    // Test data
    const testPerson = {
      email: "steven@agentuity.com",
      firstName: "Steven",
      lastName: "Jones",
      userId: "user_M4r2u8d1O2Aukv5bR6Fr5o8bR5F",
      accountCreationDate: "2021-01-01T00:00:00Z",
      leadSource: "Google",
    };

    // 1. Assert person
    const personResult = await assertPerson(testPerson);
    ctx.logger.info("assertPerson result: %o", personResult);

    // 2. Get person by email
    const personByEmail = await getPersonByEmail(testPerson.email);
    ctx.logger.info("getPersonByEmail result: %o", personByEmail);

    // 3. Get company by person email
    const company = await getCompanyByPersonEmail(testPerson.email);
    ctx.logger.info("getCompanyByPersonEmail result: %o", company);

    // 4. Update company if found
    let updateResult = null;
    const companyId = getRecordIdFromRecord(company);
    if (companyId) {
      updateResult = await updateCompany(companyId, { creditsBought: 1230 });
      ctx.logger.info("updateCompany result: %o", updateResult);
    }

    return resp.json({
      assertPerson: personResult,
      getPersonByEmail: personByEmail,
      getCompanyByPersonEmail: company,
      updateCompany: updateResult,
    });
  } catch (err: any) {
    ctx.logger.error("Error in Agent test: %o", err);
    return resp.json({ error: err.message || String(err) }, 500);
  }
}
