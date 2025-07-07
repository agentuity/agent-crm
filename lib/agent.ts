import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, type ToolSet } from "ai";
import { z } from "zod";
import { toolExecutors } from "./tools";
import { convertDatesToObjects } from "./helpers";

export const createAgent = (prompt: string, tools: ToolSet) => {
  return async function Agent(
    req: AgentRequest,
    resp: AgentResponse,
    ctx: AgentContext
  ) {
    try {
      const data = await req.data.text();
      const executionLog = [];
      const maxIterations = 10; // Safety limit to prevent infinite loops
      let iteration = 0;
      
      while (iteration < maxIterations) {
        iteration++;
        
        // Determine what tools need to be called next
        const toolsResult: { object: { toolCalls: { tool: string; args: Record<string, any> }[] } } = await generateObject({
          model: openai("gpt-4o"),
          prompt: `
          You are an intelligent agent. Your task is to carefully read the following instructions and determine what tools need to be called next.

          Instructions:
          ${prompt}

          Original Payload:
          ${data}
          
          ${executionLog.length > 0 ? `Previous Execution Results:\n${JSON.stringify(executionLog, null, 2)}` : ''}
          
          Based on the ${executionLog.length > 0 ? 'previous execution results and the' : ''} original payload, determine what tools should be called next.
          
          ${executionLog.length === 0 ? 'This is the first iteration, so start with gathering information (like checking if a person exists).' : ''}
          
          If no more tools are needed, return an empty array.
          
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

        const judgeResult = await generateObject({
          model: openai("gpt-4o"),
          prompt: `
          You are the Judge.
          • If the array of proposed calls is empty, respond {"decision":"approve"}.
          • Otherwise, approve if every element looks like {"tool": <string>, "args": <object>}.
            (You don't need to validate arg fields in detail.)
          • Reject if anything is missing or obviously invalid.
        
          Proposed calls:
          ${JSON.stringify(toolsResult.object.toolCalls, null, 2)}
        
          Respond only with JSON.
          `,
          schema: z.object({
            decision: z.enum(["approve", "reject"]),
            reason: z.string().optional(),
          }),
        });
        

        if (judgeResult.object.decision === "reject") {
          ctx.logger.warn(`Judge rejected the toolCalls: ${judgeResult.object.reason}`);
          return resp.json({
            success: false,
            error: "Sorry, the Judge rejected the toolCalls.",
            details: judgeResult.object.reason
          });
        }

        if (judgeResult.object.decision === "approve") {
          ctx.logger.info(`Judge approved the toolCalls`);
        }

        // If no tools to call, we're done
        if (toolsResult.object.toolCalls.length === 0) {
          ctx.logger.info(`No more tools to call after ${iteration - 1} iterations`);
          break;
        }

        // Execute the tools
        for (const toolCall of toolsResult.object.toolCalls) {
          const { tool, args }: { tool: string; args: Record<string, any> } = toolCall;
          const toolExecutor = toolExecutors[tool as keyof typeof toolExecutors];
          if (toolExecutor) {
            const convertedArgs = convertDatesToObjects(args);
            const result = await toolExecutor(convertedArgs);
            executionLog.push({
              tool,
              args: convertedArgs,
              result,
            });
            ctx.logger.info(`Iteration ${iteration}: Executed tool ${tool}`);
          } else {
            ctx.logger.warn(`Unknown tool: ${tool}`);
          }
        }
      }

      if (iteration >= maxIterations) {
        ctx.logger.warn(`Reached maximum iterations (${maxIterations})`);
      }

      // Return the full execution log
      return resp.json({
        success: true,
        executionLog,
        iterations: iteration,
        summary: `Executed ${executionLog.length} tools across ${iteration} iterations`
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
