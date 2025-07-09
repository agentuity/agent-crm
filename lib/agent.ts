import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { convertDatesToObjects } from "./helpers";

export const createAgent = (
  prompt: string,
  toolMetadata: Record<
    string,
    { description: string; parameters: z.ZodObject<any> }
  >,
  toolExecutors: Record<string, Function>
) => {
  // tools is a map of tool names to functions
  return async function Agent(
    req: AgentRequest,
    resp: AgentResponse,
    ctx: AgentContext
  ) {
    try {
      const allowedToolsArr = Object.keys(tools); // pull the list of tool names once so the Judge knows whats legal
      ctx.logger.info(`Allowed tools: ${allowedToolsArr.join(", ")}`);
      const data = await req.data.text();
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

          Respond with an object in this format:
          {
            toolCalls: [
              { tool: "toolName", args: { /* arguments */ } }
            ]
          }`,
          schema: z.object({
            toolCalls: z.array(
              z.object({
                tool: z.string(),
                args: z.record(z.any()),
              })
            ),
          }),
        });

        ctx.logger.info(
          `ToolsResult: ${JSON.stringify(
            toolsResult.object.toolCalls,
            null,
            2
          )}`
        );
        const allowedToolsBlock =
          "```json\n" + JSON.stringify(allowedToolsArr, null, 2) + "\n```";
        const judgeResult = await generateObject({
          model: openai("gpt-4o"),
          prompt: `
          You are the Judge.

          **Context you must review**
          1. Proposed tool calls for this iteration (below)
          2. Full execution log so far (below)
          3. The original webhook payload (below)

          **Allowed tools**
          ${allowedToolsBlock}

          **Approval rules**
          • If the proposed array is empty → {"decision":"approve"}
          • Otherwise, approve only if every element looks like {"tool": <string>, "args": <object>}
            – The "tool" value must be one of the allowed tools above (ignore spacing).
            – The call must NOT duplicate a successful call already in the execution log.
          • Reject if any call is malformed, duplicates prior work, or is obviously unnecessary.
          You can always allow the pingSlack tool.

          **Proposed calls**
          ${JSON.stringify(toolsResult.object.toolCalls, null, 2)}

          **Execution log so far**
          ${JSON.stringify(executionLog, null, 2)}

          **Original payload**
          ${data}

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
          const toolExecutor = tools[tool]; // at runtime look up the concrete function for the requested tool
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
