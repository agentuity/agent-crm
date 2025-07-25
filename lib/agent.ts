import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { Composio } from "@composio/core";
import { AnthropicProvider } from "@composio/anthropic";
import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic();

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new AnthropicProvider(),
});

export const createAgent = (
  prompt: string,
  extraTools: any[] = [],
  customToolExecutors: Record<string, Function> = {},
  verifyWebhook?: (
    rawBody: string,
    req: AgentRequest,
    resp: AgentResponse,
    ctx: AgentContext
  ) => Promise<boolean>
) => {
  return async function Agent(
    req: AgentRequest,
    resp: AgentResponse,
    ctx: AgentContext
  ) {
    const payload = await req.data.json();
    if (
      verifyWebhook &&
      !verifyWebhook(JSON.stringify(payload), req, resp, ctx)
    ) {
      return resp.json({
        success: false,
        error: "Webhook verification failed.",
      });
    }

    const userId = process.env.COMPOSIO_USER_ID;
    if (!userId) {
      throw new Error("COMPOSIO_USER_ID is not set");
    }

    const tools = await composio.tools.get(userId, {
      tools: [
        "ATTIO_FIND_RECORD",
        "ATTIO_UPDATE_RECORD",
        "ATTIO_CREATE_RECORD",
        "ATTIO_LIST_RECORDS",
        "ATTIO_GET_OBJECT",
        "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
      ],
    });

    const maxIterations = 10;
    let iteration = 0;
    let previousToolCallResults: any[] = [];
    let toolCalls: any[] = []; // The tool calls this iteration.
    let allToolCalls: any[] = []; // All tool calls made so far.
    let justRejected = false; // Whether the Judge rejected the most recent tool calls.
    let rejectReason = ""; // The reason the Judge rejected the most recent tool calls.

    while (iteration < maxIterations) {
      const response = await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        tools: [...tools, ...extraTools],
        max_tokens: 1000,
        stream: false,
        messages: [
          {
            role: "user",
            content: `
You will receive a JSON payload and a prompt that describes what you need to do.

---

📘 Instructions:
${prompt}

---

📦 JSON Payload:
${JSON.stringify(payload, null, 2)}

${
  previousToolCallResults.length > 0
    ? `\n---\n🔁 Iteration ${iteration}\nPrevious tool call results:\n${JSON.stringify(
        previousToolCallResults,
        null,
        2
      )}`
    : ""
}

${
  justRejected
    ? `\n---\n❌ The Judge rejected the most recent tool calls:\n${JSON.stringify(
        toolCalls,
        null,
        2
      )}\nReason: ${rejectReason}`
    : ""
}

${
  allToolCalls.length > 0
    ? `\n---\n🛠️ Tool calls made so far:\n${JSON.stringify(
        allToolCalls,
        null,
        2
      )}`
    : ""
}
`,
          },
        ],
      });

      // Claude returns a list of content blocks in `response.content`
      toolCalls = response.content.filter((block) => block.type === "tool_use");

      // If there are no tool calls, we're done.
      if (!toolCalls.length) {
        ctx.logger.info("No tool calls detected, finishing up.");
        const textBlock = response.content.find(
          (block) => block.type === "text"
        );
        return resp.text(textBlock ? textBlock.text : "No response");
      }

      //JUDGE THE TOOL CALLS HERE
      const judgeResponse = await client.messages.create({
        model: "claude-3-5-haiku-20241022", // Using cheaper Haiku for judge too
        max_tokens: 1000,
        stream: false,
        messages: [
          {
            role: "user",
            content: `
You are the Judge. You are given an array of tool calls and a list of allowed tools.

You must approve or reject the tool calls by responding ONLY with valid JSON in this exact format:
{ "decision": "approve", "reason": "explanation" }
OR
{ "decision": "reject", "reason": "explanation" }

**Approval rules**
- Make sure that the tool calls are in the correct format.
- Make sure that the proposed tool calls are within the allowed tools.
- Make sure that the proposed tool calls use the correct arguments for the tool.
- Make sure that the proposed tool calls are not dangerous.

**Allowed tools**
${JSON.stringify([...tools, ...extraTools], null, 2)}

**Proposed calls**
${JSON.stringify(toolCalls, null, 2)}

Respond ONLY with the JSON decision object, no other text:
`,
          },
        ],
      });

      // Parse the judge response.
      const judgeBlock = judgeResponse.content.find((b) => b.type === "text");
      let judgeDecision: { decision: string; reason: string } | null = null;
      if (judgeBlock?.text) {
        try {
          judgeDecision = JSON.parse(judgeBlock.text);
        } catch (error) {
          ctx.logger.error(
            "Judge response that failed to parse:",
            judgeBlock.text
          );
          return resp.text(
            `Judge response could not be parsed. Raw response: ${judgeBlock.text}`
          );
        }
      } else {
        ctx.logger.info(
          "Full judge response:",
          JSON.stringify(judgeResponse.content, null, 2)
        );
        return resp.text("No judge response found.");
      }

      if (!judgeDecision) return resp.text("No judge decision.");

      if (judgeDecision.decision === "reject") {
        justRejected = true;
        ctx.logger.info("Rejected tool calls:", toolCalls, judgeDecision);
        rejectReason = judgeDecision.reason;
        iteration++;
        continue;
      }

      // Judge approved the tool calls
      justRejected = false;
      rejectReason = "";

      const customToolNames = new Set(extraTools.map((tool) => tool.name));

      const customToolCalls = toolCalls.filter((call: any) =>
        customToolNames.has(call.name)
      );
      const composioToolCalls = toolCalls.filter(
        (call: any) => !customToolNames.has(call.name)
      );

      let toolCallResult: any = {};

      // Execute custom tools
      if (customToolCalls.length > 0) {
        ctx.logger.info("Executing custom tools:", customToolCalls);
        const customResults: any[] = [];

        for (const toolCall of customToolCalls) {
          const executor = customToolExecutors[toolCall.name];
          if (executor) {
            try {
              const result = await executor(toolCall.input); // This is where the tool call is executed based on its executor.
              customResults.push({
                tool_call_id: toolCall.id,
                type: "tool_result",
                content: JSON.stringify(result),
              });
            } catch (error) {
              customResults.push({
                tool_call_id: toolCall.id,
                type: "tool_result",
                content: `Error: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              });
            }
          } else {
            customResults.push({
              tool_call_id: toolCall.id,
              type: "tool_result",
              content: `Error: No executor found for tool ${toolCall.name}`,
            });
          }
        }

        // If there are no composio tools, return the custom results - otherwise, merge them later
        if (composioToolCalls.length === 0) {
          toolCallResult = customResults;
        } else {
          toolCallResult.customResults = customResults;
        }
      }

      // Execute composio tools if any
      if (composioToolCalls.length > 0) {
        ctx.logger.info("Executing composio tools:", composioToolCalls);

        // Create a response-like object with only composio tool calls
        const composioResponse = {
          ...response,
          content: response.content
            .map((block: any) => {
              if (
                block.type === "tool_use" &&
                composioToolCalls.some((call: any) => call.id === block.id)
              ) {
                return block;
              }
              return block.type === "tool_use" ? null : block;
            })
            .filter(Boolean),
        };

        const composioResult = await composio.provider.handleToolCalls(
          userId,
          composioResponse
        );

        if (customToolCalls.length === 0) {
          // Only composio tools
          toolCallResult = composioResult;
        } else {
          // Both custom and composio tools, merge results
          toolCallResult = {
            ...composioResult,
            customResults: toolCallResult.customResults,
          };
        }
      }

      previousToolCallResults.push(toolCallResult);
      allToolCalls.push(...toolCalls);
      iteration++;
    }

    return resp.text("Ran out of iterations.");
  };
};
