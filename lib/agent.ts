import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, type ToolSet } from "ai";
import { z } from "zod";

export const createAgent = (prompt: string, tools: ToolSet) => {
  return async function Agent(
    req: AgentRequest,
    resp: AgentResponse,
    ctx: AgentContext
  ) {
    try {
      const data = await req.data.json();
      const result = await generateObject({
        model: openai("gpt-4o"),
        prompt: `
        You are an intelligent agent. Your task is to carefully read the following instructions and the provided JSON payload. 
        Use the instructions to determine what information to extract from the payload and which tools to call. 
        For each relevant action, select the most appropriate tool and provide the required arguments.

        Instructions:
        ${prompt}

        Payload:
        ${JSON.stringify(data)}
        
        Based on the payload, decide which tools to call and with what arguments. Respond with an array in this format:
        [
          { tool: "toolName", args: { /* arguments */ } }
        ]`,
        schema: z.object({
          toolCalls: z.array(
            z.object({
              tool: z.string(),
              args: z.record(z.any()),
            })
          ),
        }),
      });
      return resp.text(JSON.stringify(result.object));
    } catch (error) {
      ctx.logger.error("Error running agent:", error);
      return resp.text("Sorry, there was an error processing your request.");
    }
  };
};
