import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { addPerson, getPeople } from "../../../lib/db";
import {
  addPersonTool,
  getPeopleTool,
  updatePersonByEmailTool,
  getPersonByEmailTool,
} from "../../../lib/tools";

export const welcome = () => {
  return {
    welcome: "crm agent.",
    prompts: [
      {
        data: "test",
        contentType: "text/plain",
      },
    ],
  };
};

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  //   try {
  //     const data = await req.data.json();
  //     const result = await generateObject({
  //       prompt: `
  // Your task: examine the JSON payload and decide which type of event it represents.
  // Allowed categories are:
  // 1. "email"        → anything related to an email being sent, received, opened, bounced, etc.
  // 2. "meeting"      → a calendar event such as a meeting, appointment, or call (usually has fields like start-time, end-time, attendees).
  // 3. "transaction"  → a monetary action (payment, refund, invoice, subscription, charge-failed, etc.).
  // Return **exactly** one line of valid JSON with a single key:
  // { "category": "<email | meeting | transaction>" }
  // <payload>
  // ${JSON.stringify(data)}
  // </payload>`,
  //       model: openai("gpt-4o"),
  //       schema: z.object({
  //         category: z.enum(["email", "meeting", "transaction"]),
  //       }),
  //     });
  //     return resp.json(result.object);
  //   } catch (error) {
  //     ctx.logger.error("Error running agent:", error);
  //     return resp.text("Sorry, there was an error processing your request.");
  //   }
  try {
    const data = await req.data.json();
    const result = await generateText({
      model: openai("gpt-4o"),
      prompt: `
      You will get an email event as a payload. You must update the database with the new information.
      You should first check if the person's exists in the database with their email.
      If they do, you should update the database with the new information.
      If they do not, you should add them to the database.

      <payload>
      ${JSON.stringify(data)}
      </payload>  
      `,
      tools: { addPersonTool, updatePersonByEmailTool, getPersonByEmailTool },
      maxSteps: 10,
    });
    return resp.text("DONE");
  } catch (error) {
    ctx.logger.error("Error running agent:", error);
    return resp.text("Sorry, there was an error processing your request.");
  }
}
