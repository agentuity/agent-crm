import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { addPerson, getPeople } from "./db";
import {
  addPersonTool,
  getPeopleTool,
  updatePersonByEmailTool,
  getPersonByEmailTool,
} from "./tools";

export const createAgent = (prompt: string) => {
  return async function Agent(
    req: AgentRequest,
    resp: AgentResponse,
    ctx: AgentContext
  ) {
    try {
      const data = await req.data.json();
      const result = await generateText({
        model: openai("gpt-4o"),
        prompt:
          prompt +
          `<payload>
        ${JSON.stringify(data)}
        </payload>`,
        tools: { addPersonTool, updatePersonByEmailTool, getPersonByEmailTool },
        maxSteps: 10,
      });
      return resp.text("DONE");
    } catch (error) {
      ctx.logger.error("Error running agent:", error);
      return resp.text("Sorry, there was an error processing your request.");
    }
  };
};
