import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { Composio, AuthScheme } from "@composio/core";
import { AnthropicProvider } from "@composio/anthropic";
import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic();

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new AnthropicProvider(),
});

// const userId = "n";
// const connection = await composio.toolkits.authorize(userId, "ATTIO");
// console.log(`🔗 Visit the URL to authorize:\n👉 ${connection.redirectUrl}`);
// const tools = await composio.tools.get(userId, { toolkits: ["ATTIO"] });
// await connection.waitForConnection();

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  const prompt = await req.data.text();

  const tools = await composio.tools.get("nick", {
    toolkits: ["ATTIO"],
  });

  // Note: Need to specify attribute names for the tool call: the default for email is "email" but it should be "email_addresses"

  const maxIterations = 10;
  let iteration = 0;
  let previousToolCallResults: any[] = [];
  let allToolCalls: any[] = [];

  while (iteration < maxIterations) {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20240620",
      tools,
      max_tokens: 1000,
      stream: false,
      messages: [
        {
          role: "user",
          content: `
You should use tools to find information in Attio and answer the user's question based on that information.
Any tool call should be unique, the tool call you decide to make should not be in the array of previous tool calls. They are expressely forbidden.
User's question:
${prompt}

${
  previousToolCallResults.length > 0
    ? `Previous tool call results:\n${JSON.stringify(
        previousToolCallResults,
        null,
        2
      )}`
    : ""
}

${
  allToolCalls.length > 0
    ? `Tool calls made so far:\n${JSON.stringify(allToolCalls, null, 2)}`
    : ""
}
`,
        },
      ],
    });

    // Claude returns a list of content blocks in `response.content`
    const toolCalls = response.content.filter(
      (block) => block.type === "tool_use"
    );

    if (toolCalls.length) {
      const suggestions = toolCalls.map((call) => ({
        toolName: call.name, // `name`, not `function.name`
        arguments: call.input, // `input`, not `function.arguments`
      }));

      console.log({
        message: "The model suggests multiple tool calls:",
        suggestions,
      });
      allToolCalls.push(...toolCalls);
    } else {
      console.log("No tool calls");
      const textBlock = response.content.find((block) => block.type === "text");
      return resp.text(textBlock ? textBlock.text : "No response");
    }

    //TODO: JUDGE THE TOOL CALLS HERE

    const toolCallResult = await composio.provider.handleToolCalls(
      "nick",
      response
    );
    // console.log("resp", toolCallResult);
    previousToolCallResults.push(toolCallResult);
    iteration++;
  }

  return resp.text("Ran out of iterations.");
}
