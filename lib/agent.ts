import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { convertDatesToObjects } from "./helpers";

export const createAgent = (
  prompt: string,
  toolMetadata: {
    name: string;
    description: string;
    parameters: any;
  }[],
  toolExecutors: Record<string, Function>,
  verifyWebhook?: (rawBody: string, req: AgentRequest, resp: AgentResponse, ctx: AgentContext) => Promise<boolean>
) => {
  // tools is a map of tool names to functions
  return async function Agent(
    req: AgentRequest,
    resp: AgentResponse,
    ctx: AgentContext
  ) {
    try {
      const rawBody = await req.data.text();
      if (verifyWebhook && !(await verifyWebhook(rawBody, req, resp, ctx))) {
        return resp.json({ success: false, error: "Webhook verification failed" });
      }

      const data = rawBody;
      const executionLog = [];
      const maxIterations = 10; // Safety limit to prevent infinite loops
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;

        // Determine what tools need to be called next
        const toolsResult: {
          object: { toolCalls: { tool: string; args: Record<string, any> }[] };
        } = await generateObject({
          model: openai("gpt-4o"),
          prompt: `
          You are an intelligent agent. Your task is to carefully read the following instructions and determine what tools need to be called next.

          Instructions:
          ${prompt}

          Original Payload:
          ${data}

          ${
            executionLog.length > 0
              ? `Previous Execution Results:\n${JSON.stringify(
                  executionLog,
                  null,
                  2
                )}`
              : ""
          }

          Based on the ${
            executionLog.length > 0 ? "previous execution results and the" : ""
          } original payload, determine what tools should be called next.

          ${
            executionLog.length === 0
              ? "This is the first iteration, so start with gathering information (like checking if a person exists)."
              : ""
          }

          If no more tools are needed, return an empty array.

          **Allowed tools**
          ${JSON.stringify(toolMetadata, null, 2)}

          CRITICAL: You must respond with a JSON object containing a "toolCalls" array. Each tool call MUST have both "tool" and "args" fields.

          Required format:
          {
            "toolCalls": [
              { 
                "tool": "toolName", 
                "args": { "param1": "value1", "param2": "value2" } 
              }
            ]
          }

          IMPORTANT:
          - The "args" field is MANDATORY, even if empty: "args": {}
          - Use the exact parameter names from the tool metadata
          - If no tools are needed, return: { "toolCalls": [] }

          Examples:
          - { "toolCalls": [{ "tool": "getPersonByEmail", "args": { "email": "user@example.com" } }] }
          - { "toolCalls": [{ "tool": "assertPerson", "args": { "email": "user@example.com", "firstName": "John" } }] }
          - { "toolCalls": [] }`,
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
          ${JSON.stringify(toolMetadata, null, 2)}

          **Proposed calls**
          ${JSON.stringify(toolsResult.object.toolCalls, null, 2)}

          Respond only with JSON:
          { "decision":"approve" | "reject", "reason":"optional explanation, please list all the allowed tools here if you deem a tool call unallowed" }
          `,
          schema: z.object({
            decision: z.enum(["approve", "reject"]),
            reason: z.string().optional(),
          }),
        });

        if (judgeResult.object.decision === "reject") {
          ctx.logger.warn(
            `Judge rejected the toolCalls: ${judgeResult.object.reason}`
          );
          return resp.json({
            success: false,
            error: "Sorry, the Judge rejected the toolCalls.",
            details: judgeResult.object.reason,
          });
        }

        if (judgeResult.object.decision === "approve") {
          ctx.logger.info(`Judge approved the toolCalls`);
        }

        // If no tools to call, we're done
        if (toolsResult.object.toolCalls.length === 0) {
          ctx.logger.info(
            `No more tools to call after ${iteration - 1} iterations`
          );
          break;
        }

        // Execute the tools
        for (const toolCall of toolsResult.object.toolCalls) {
          const { tool, args }: { tool: string; args: Record<string, any> } =
            toolCall;

          const toolExecutor = toolExecutors[tool]; // at runtime look up the concrete function for the requested tool

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
        summary: `Executed ${executionLog.length} tools across ${iteration} iterations`,
      });
    } catch (error) {
      ctx.logger.error("Error running agent:", error);
      return resp.json({
        success: false,
        error: "Sorry, there was an error processing your request.",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };
};
