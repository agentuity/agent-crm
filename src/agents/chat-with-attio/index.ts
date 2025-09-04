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
  try {
    const text = await req.data.text();
    ctx.logger.info("Received message:", text);

    const userId = "default";

    // Get all ATTIO tools
    const tools = await composio.tools.get(userId, {
      toolkits: ["ATTIO"],
    });

    // Send message to Claude with ATTIO tools
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      tools: tools,
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are an AI assistant with access to ATTIO CRM tools. Help the user with their request:

${text}

You can use any of the available ATTIO tools to search, create, update, or manage records in their CRM. Be helpful and explain what you're doing and what you found.`,
        },
      ],
    });

    // Check if Claude wants to use tools
    const toolCalls = response.content.filter(
      (block) => block.type === "tool_use"
    );

    if (toolCalls.length > 0) {
      // Execute the tool calls manually
      const toolResults = [];

      for (const toolCall of toolCalls) {
        try {
          ctx.logger.info(`Executing tool: ${toolCall.name}`, {
            id: toolCall.id,
            input: toolCall.input,
          });

          const result = await composio.tools.execute(toolCall.name, {
            userId,
            arguments: toolCall.input as Record<string, unknown>,
          });

          ctx.logger.info(`Tool result for ${toolCall.name}:`, result);

          toolResults.push({
            tool_use_id: toolCall.id,
            type: "tool_result" as const,
            content: JSON.stringify(result),
          });
        } catch (error) {
          ctx.logger.error(`Tool error for ${toolCall.name}:`, error);

          toolResults.push({
            tool_use_id: toolCall.id,
            type: "tool_result" as const,
            content: `Error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          });
        }
      }

      // Send results back to Claude for final response
      const finalResponse = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `You are an AI assistant with access to ATTIO CRM tools. Help the user with their request:

${text}

You can use any of the available ATTIO tools to search, create, update, or manage records in their CRM. Be helpful and explain what you're doing and what you found.`,
          },
          {
            role: "assistant",
            content: response.content,
          },
          {
            role: "user",
            content: toolResults as any,
          },
        ],
      });

      const textBlock = finalResponse.content.find(
        (block) => block.type === "text"
      );
      return resp.text(textBlock ? textBlock.text : "No response generated");
    } else {
      // No tools needed, return Claude's direct response
      const textBlock = response.content.find((block) => block.type === "text");
      return resp.text(textBlock ? textBlock.text : "No response generated");
    }
  } catch (error) {
    ctx.logger.error("Error in chat-with-attio agent:", error);
    return resp.text(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
