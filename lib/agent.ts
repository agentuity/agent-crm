import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { Composio } from "@composio/core";
import { AnthropicProvider } from "@composio/anthropic";
import { Anthropic } from "@anthropic-ai/sdk";

export const createAgent = (
  prompt: string,
  extraTools: any[] = [],
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
    const rawBody = await req.data.text();
    if (verifyWebhook && !verifyWebhook(rawBody, req, resp, ctx)) {
      return resp.json({
        success: false,
        error: "Webhook verification failed.",
      });
    }

    const client = new Anthropic();

    const composio = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
      provider: new AnthropicProvider(),
    });

    const tools = await composio.tools.get("nick", {
      toolkits: ["ATTIO"],
    });

    const payload = JSON.parse(rawBody); // parse it here because we read it as text for verification

    // Note: Need to specify attribute names for the tool call: the default for email is "email" but it should be "email_addresses"
    const maxIterations = 10;
    let iteration = 0;
    let previousToolCallResults: any[] = [];
    let toolCalls: any[] = []; // The tool calls this iteration.
    let allToolCalls: any[] = []; // All tool calls made so far.
    let justRejected = false; // Whether the Judge rejected the most recent tool calls.
    let rejectReason = ""; // The reason the Judge rejected the most recent tool calls.

    while (iteration < maxIterations) {
      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20240620",
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
      )}`
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

      // Log text responses to see LLM's reasoning
      const textBlocks = response.content.filter(
        (block) => block.type === "text"
      );
      if (textBlocks.length > 0) {
        console.log(`--- Iteration ${iteration} Text Response ---`);
        textBlocks.forEach((block, index) => {
          console.log(block.text);
        });
        console.log("--- End Text Response ---");
      }

      if (toolCalls.length) {
        console.log("Tool calls", toolCalls);
      } else {
        console.log("No tool calls, done.");
        const textBlock = response.content.find(
          (block) => block.type === "text"
        );
        return resp.text(textBlock ? textBlock.text : "No response");
      }

      //JUDGE THE TOOL CALLS HERE
      const judgeResponse = await client.messages.create({
        model: "claude-3-5-sonnet-20240620",
        tools,
        max_tokens: 1000,
        stream: false,
        messages: [
          {
            role: "user",
            content: `
You are the Judge. You are given an array of tool calls of the form:
{ tool: "toolName", args: { /* arguments */ } }

And a list of allowed tools and their parameters.

You must approve or reject the tool calls.

**Approval rules**
- Make sure that the tool calls are in the correct format.
- Make sure that the proposed tool calls are within the allowed tools.
- Make sure that the proposed tool calls use the correct arguments for the tool.
- Make sure that the proposed tool calls are not dangerous.

**Allowed tools**
${JSON.stringify(tools, null, 2)}

**Proposed calls**
${JSON.stringify(toolCalls, null, 2)}

Respond only with JSON:
{ 
  "decision":"approve" | "reject", 
  "reason":"explain why you made this decision"
}
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
        } catch {
          return resp.text("Judge response could not be parsed.");
        }
      } else {
        return resp.text("No judge response found.");
      }
      if (!judgeDecision) return resp.text("No judge decision.");
      if (judgeDecision.decision === "reject") {
        console.log(
          `Judge rejected the tool calls. Reason: ${judgeDecision.reason}`
        );
        justRejected = true;
        rejectReason = judgeDecision.reason;
        iteration++;
        continue;
      }

      // If we get here, the Judge approved the tool calls.
      justRejected = false;
      rejectReason = "";

      // Execute the tool calls.
      const toolCallResult = await composio.provider.handleToolCalls(
        "nick",
        response
      );

      // Log tool call results to see what the tools return
      console.log(`--- Iteration ${iteration} Tool Call Results ---`);
      console.log(JSON.stringify(toolCallResult, null, 2));
      console.log("--- End Tool Call Results ---");

      previousToolCallResults.push(toolCallResult);
      iteration++;
    }

    return resp.text("Ran out of iterations.");
  };
};
