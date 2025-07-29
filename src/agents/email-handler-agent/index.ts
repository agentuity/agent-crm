import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { Composio } from "@composio/core";
import { AnthropicProvider } from "@composio/anthropic";
import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic();

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  const composio = new Composio({
    apiKey: process.env.COMPOSIO_API_KEY,
    provider: new AnthropicProvider(),
  });
  const userId = "default";

  const tools = await composio.tools.get(userId, {
    tools: ["SLACKBOT_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL"],
  });

  // Define any custom tools here if needed
  const extraTools: any[] = [];
  const customToolExecutors: Record<string, Function> = {};

  let dataResponse = await ctx.kv.get("positive_leads", "emails");
  if (dataResponse.exists) {
    let positive_emails = (await dataResponse.data.json()) as any[];
    for (let to_email of positive_emails) {
      dataResponse = await ctx.kv.get("emails", to_email);
      if (dataResponse.exists) {
        let email_data = (await dataResponse.data.json()) as {
          from_email: string;
          body: string;
        };
        let from_email = email_data.from_email;
        let body = email_data.body;
        let prompt = `
        Your job is to process the following email:
        The email is from: ${to_email}
        The email is to: ${from_email}
        The email body is:
        ${body}

        You should operate under these rules:
        - If the email is simple, you must draft a reply.
          - If the email asks for a meeting, you should send this calendar link: https://cal.com/agentuity/30min
          - If the email asks about a website, you should send this link: https://agentuity.com
          - Please follow these steps to place your reply in Slack:
          CALL THE SLACKBOT_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL tool with the following input:
          {
            "channel": "#agent-test-channel-nick",
            "text": "📬 *Email!*
                    <@ID>, you have a new email from <${to_email}> Check your inbox (<${from_email}>). Here is my suggestion for a reply:
                    [YOUR SUGGESTION EMAIL BODY HERE].
                    "
          } 

        - ELSE, if the email is complex, you should perform the following steps:
          Call the SLACKBOT_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL tool with the following input:
          {
            "channel": "#agent-test-channel-nick",
            "text": "📬 *Email!*
                    <@ID>, you have a new email from <${from_email}> and it was too hard for me to figure out with my small LLM brain. Check your inbox (<${to_email}>).
                    "
          }
          where ID is the user id of the person who should receive the message. You must determine this to be either Jeff Haynie, or Rick Blalock based on the ${to_email}.
          The ids are:
          - Jeff Haynie: U08993W8V0T
          - Rick Blalock: U088UL77GDV
          You must keep the ids in the format <@ID> including the "<@" and ">".

        `;
        let response = await client.messages.create({
          model: "claude-3-7-sonnet-20250219",
          messages: [{ role: "user", content: prompt }],
          tools: [...tools, ...extraTools],
          max_tokens: 1000,
          stream: false,
        });

        // Extract tool calls from the response
        const toolCalls = response.content.filter(
          (block) => block.type === "tool_use"
        );

        // If there are tool calls, execute them
        if (toolCalls.length > 0) {
          ctx.logger.info("Executing tool calls:", toolCalls);

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
                  const result = await executor(toolCall.input, ctx);
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

          ctx.logger.info("Tool execution completed:", toolCallResult);
        } else {
          // Handle text response if no tool calls
          ctx.logger.info("No tool calls detected, finishing up.");
          const textBlock = response.content.find(
            (block) => block.type === "text"
          );
          if (textBlock) {
            ctx.logger.info("Received text response:", textBlock.text);
            return resp.text(textBlock.text);
          } else {
            ctx.logger.info("No text response detected");
            return resp.text("No response");
          }
        }
      }
    }
    ctx.logger.info(
      `Finished processing positive emails. ${positive_emails.length} emails processed.`
    );
    return resp.text(
      `Finished processing positive emails. ${positive_emails.length} emails processed.`
    );
  } else {
    ctx.logger.info("Failed to get positive emails from KV");
    return resp.text("Failed to get positive emails from KV");
  }
}
