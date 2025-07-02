import { createAgent } from "../../../lib/agent";

const prompt = `
You have access to the following tools for managing people in the attio_mockup table:

1. addPerson
   - Description: Add a new person to the database.
   - Parameters: Requires the person's name and email address. You can also provide optional dates for first/last email interaction, first/next/last calendar interaction.
   - When to use: Use this tool when you need to create a new person record.

2. getPeople
   - Description: Retrieve a list of people from the database.
   - Parameters: Optionally specify a limit (1-100) for the number of people to return.
   - When to use: Use this tool when you need to list people, or when searching for people in general.

3. updatePersonByEmail
   - Description: Update a person's details using their email address as the identifier.
   - Parameters: Requires the email address. You can update the name and any of the interaction dates (set to null to clear a date).
   - When to use: Use this tool to modify an existing person's information.

4. getPersonByEmail
   - Description: Retrieve details for a specific person by their email address.
   - Parameters: Requires the email address.
   - When to use: Use this tool to look up a single person's details.
`;

export default createAgent(prompt, {});
