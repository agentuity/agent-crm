import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, type ToolSet } from "ai";
import { z } from "zod";
import { toolExecutors } from "./tools";

// Helper function to convert date strings to Date objects
function convertDatesToObjects(args: Record<string, any>): Record<string, any> {
  const convertedArgs = { ...args };
  
  // List of date field names that might need conversion
  const dateFields = [
    'firstEmailInteraction',
    'lastEmailInteraction', 
    'firstCalendarInteraction',
    'nextCalendarInteraction',
    'lastCalendarInteraction'
  ];
  
  for (const field of dateFields) {
    if (convertedArgs[field] && typeof convertedArgs[field] === 'string') {
      convertedArgs[field] = new Date(convertedArgs[field]);
    }
  }
  
  return convertedArgs;
}

export const createAgent = (prompt: string, tools: ToolSet) => {
  return async function Agent(
    req: AgentRequest,
    resp: AgentResponse,
    ctx: AgentContext
  ) {
    try {
      const data = await req.data.text();
      const executionLog = [];
      
      // Step 1: Determine initial tools to call (should be getPersonByEmail)
      const initialToolsResult = await generateObject({
        model: openai("gpt-4o"),
        prompt: `
        You are an intelligent agent. Your task is to carefully read the following instructions and the provided JSON payload. 
        Based on the webhook data, determine the initial tools that need to be called.

        Instructions:
        ${prompt}

        Payload:
        ${data}
        
        First, identify what tools should be called to gather information (like checking if a person exists).
        Respond with an array in this format:
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

      // Step 2: Execute initial tools
      for (const toolCall of initialToolsResult.object.toolCalls) {
        const { tool, args } = toolCall;
        if (toolExecutors[tool]) {
          const convertedArgs = convertDatesToObjects(args);
          const result = await toolExecutors[tool](convertedArgs);
          executionLog.push({
            tool,
            args: convertedArgs,
            result,
          });
          ctx.logger.info(`Executed tool ${tool} with result:`, result);
        }
      }

      // Step 3: Based on results, determine next tools to call
      const followUpToolsResult = await generateObject({
        model: openai("gpt-4o"),
        prompt: `
        You are an intelligent agent. Based on the initial tool execution results, determine what additional tools need to be called.

        Instructions:
        ${prompt}

        Original Payload:
        ${data}
        
        Execution Results:
        ${JSON.stringify(executionLog, null, 2)}
        
        Based on the execution results, determine what additional tools should be called.
        For example:
        - If getPersonByEmail returned null/empty, call addPerson to create a new person
        - If getPersonByEmail returned a person, call updatePersonByEmail to update their information
        
        Respond with an array in this format:
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

      // Step 4: Execute follow-up tools
      for (const toolCall of followUpToolsResult.object.toolCalls) {
        const { tool, args } = toolCall;
        if (toolExecutors[tool]) {
          const convertedArgs = convertDatesToObjects(args);
          const result = await toolExecutors[tool](convertedArgs);
          executionLog.push({
            tool,
            args: convertedArgs,
            result,
          });
          ctx.logger.info(`Executed tool ${tool} with result:`, result);
        }
      }

      // Return the full execution log
      return resp.json({
        success: true,
        executionLog,
        summary: `Executed ${executionLog.length} tools successfully`
      });
      
    } catch (error) {
      ctx.logger.error("Error running agent:", error);
      return resp.json({
        success: false,
        error: "Sorry, there was an error processing your request.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };
};
