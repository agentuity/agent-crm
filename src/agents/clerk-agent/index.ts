import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  return resp.text('Hello from Agentuity!');
}
