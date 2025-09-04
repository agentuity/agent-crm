import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { Composio } from "@composio/core";
import { AnthropicProvider } from "@composio/anthropic";
import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic();

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new AnthropicProvider(),
});

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  const request = await req.data.text();
  const userId = "default";

  const tools = await composio.tools.get(userId, {
    toolkits: ["ATTIO"],
  });

  const maxIterations = 10;
  let iteration = 0;
  let allToolCalls: any[] = [];
  let rejectedToolCalls: Array<{ toolCall: any; result: any; reason: string }> =
    [];

  while (iteration < maxIterations) {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      tools: tools,
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `
          # Task
          Your job is to use the provided Attio CRM tools to find the appropriate object in Attio according to a user's request.
          Stop making tool calls when you have found the answer.

          ## Guidelines
          1. Do not repeat tool calls. If a tool call does not give you what you want, never duplicate it.
          2. Utilize all READ tools at your disposal. If the tool you expect doesn't work, try something else.
          3. NEVER use WRITE/UPDATE tools. These are off limits.
          4. Learn from previously rejected tool calls - if a tool call was rejected for not answering the query, try a different approach or different tools.

          **CRITICAL**
          Note: We use CUSTOM ATTIO ATTRIBUTES \`user_id\` and \`org_id\`. In order to search for these with the tools you have,
          you must *nest* them inside of an attributes field.
          Example:
          "ATTIO_FIND_RECORD":
          {
            object_id: <specified object>,
            attributes: {
              user_id: <user_id value>,
              org_id: <org_id value>
            },
          }

          Request: ${request}

          ${
            rejectedToolCalls.length > 0
              ? `\nPreviously rejected tool calls:\n${rejectedToolCalls
                  .map(
                    (rejected, index) =>
                      `${index + 1}. Tool Call: ${JSON.stringify(
                        rejected.toolCall,
                        null,
                        2
                      )}\n   Result: ${JSON.stringify(
                        rejected.result,
                        null,
                        2
                      )}\n   Rejection Reason: ${rejected.reason}`
                  )
                  .join("\n\n")}`
              : ""
          }
`,
        },
      ],
    });

    const toolCalls = response.content.filter(
      (block) => block.type === "tool_use"
    );

    if (toolCalls.length === 0) {
      break;
    }

    ctx.logger.info("Proposed tool calls:", toolCalls);
    allToolCalls.push(toolCalls);

    const toolCallResult = await composio.provider.handleToolCalls(
      userId,
      response
    );

    ctx.logger.info("Result:", toolCallResult);

    // Second LLM call to analyze if the tool result answers the user's query
    const analysisResponse = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `
          You are analyzing whether a tool call result successfully answers a user's query.
          Typically, users will be requesting record data such as an attribute from a person or company.
          
          Original User Request: ${request}
          
          Tool Call Made: ${JSON.stringify(toolCalls, null, 2)}
          
          Tool Call Result: ${JSON.stringify(toolCallResult, null, 2)}
          
          Analyze if this tool call result contains the information needed to answer the original user request.
          
          Respond with a JSON object in this exact format:
          {
            "success": true/false,
            "reason": "explanation of why it succeeds or fails to answer the query"
          }
          
          If the result contains the requested information or data, return success: true.
          If the result is incomplete, irrelevant, or doesn't contain the requested information, return success: false with a clear reason.
          **CRITICAL**: Your response must directly parse via JSON.parse(), so do not add any extra text or wrap your response in \`\`\`json.
          `,
        },
      ],
    });

    let analysisResult: { success: boolean; reason: string };
    try {
      const analysisText =
        analysisResponse.content.find((block) => block.type === "text")?.text ||
        "";
      analysisResult = JSON.parse(analysisText);
    } catch (error) {
      // Fallback if JSON parsing fails
      analysisResult = {
        success: false,
        reason: "Could not parse analysis result",
      };
    }

    ctx.logger.info("Analysis:", analysisResult);

    if (analysisResult.success) {
      // Tool call successfully answered the query, break the loop
      return resp.json(toolCallResult || { error: "No tool results found" });
    } else {
      // Tool call didn't answer the query, add to rejected list
      rejectedToolCalls.push({
        toolCall: toolCalls,
        result: toolCallResult,
        reason: analysisResult.reason,
      });
    }
    iteration++;
  }
  return resp.json({
    error: "Ran out of iterations, unable to get results from Attio.",
  });
}
