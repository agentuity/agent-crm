import { createAgent } from "../../../lib/agent";

const prompt = `
You will get an event as a payload. You must update the database with the new information.
The event can be an email or a calendar meeting.
You should first check if the person exists in the database with their email.
If they do, you should update the database with the new information (including email and calendar interactions).
If they do not, you should add them to the database.`;

export default createAgent(prompt);
