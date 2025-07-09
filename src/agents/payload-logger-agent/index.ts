import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  let payload = await req.data.json();
  ctx.logger.info(payload);
  return resp.json(payload);
}
