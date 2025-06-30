import type { AgentContext, AgentRequest, AgentResponse } from '@agentuity/sdk';
import OpenAI from 'openai';

const client = new OpenAI();

export const welcome = () => {
  return {
    welcome:
      'Welcome to the OpenAI TypeScript Agent! I can help you build AI-powered applications using OpenAI models.',
    prompts: [
      {
        data: 'How do I implement streaming responses with OpenAI models?',
        contentType: 'text/plain',
      },
      {
        data: 'What are the best practices for prompt engineering with OpenAI?',
        contentType: 'text/plain',
      },
    ],
  };
};

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext
) {
  try {
    const result = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: (await req.data.text()) ?? 'Hello, OpenAI',
        },
      ],
    });

    return resp.text(
      result.choices[0]?.message.content ?? 'Something went wrong'
    );
  } catch (error) {
    ctx.logger.error('Error running agent:', error);

    return resp.text('Sorry, there was an error processing your request.');
  }
}
