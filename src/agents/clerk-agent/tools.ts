import type { AgentContext } from "@agentuity/sdk";
import { Composio } from "@composio/core";

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
});

// Tool definition for the LLM
export const formatDateTool = {
  name: "FORMAT_DATE",
  description:
    "Converts a Unix timestamp (milliseconds or seconds) to a formatted date string",
  input_schema: {
    type: "object",
    properties: {
      timestamp: {
        type: "number",
        description: "Unix timestamp in milliseconds or seconds",
      },
      format: {
        type: "string",
        description:
          "Date format: 'short' (Aug 6, 2025), 'long' (August 6, 2025), 'iso' (2025-08-06)",
        enum: ["short", "long", "iso"],
        default: "short",
      },
    },
    required: ["timestamp"],
  },
};

// Executor function for the FORMAT_DATE tool
export const formatDateExecutor = async (input: any, ctx: AgentContext) => {
  try {
    const { timestamp, format = "short" } = input;

    // Handle both seconds and milliseconds timestamps
    let date: Date;
    if (timestamp < 10000000000) {
      // Likely seconds (before year 2286 in seconds)
      date = new Date(timestamp * 1000);
    } else {
      // Likely milliseconds
      date = new Date(timestamp);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      throw new Error("Invalid timestamp");
    }

    // Format based on requested format
    switch (format) {
      case "short":
        // "Aug 6, 2025"
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

      case "long":
        // "August 6, 2025"
        return date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

      case "iso":
        // "2025-08-06"
        return date.toISOString().split("T")[0];

      default:
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
    }
  } catch (error: any) {
    ctx.logger.error("Date formatting error:", error);
    return `Error formatting date: ${error.message}`;
  }
};

// Tool definition for handling user.created webhook
export const handleUserCreatedTool = {
  name: "HANDLE_USER_CREATED",
  description:
    "Handles user.created webhook: creates/updates person, finds/creates company, sends Slack notification",
  input_schema: {
    type: "object",
    properties: {
      data: {
        type: "object",
        description: "The webhook data payload containing user information",
        properties: {
          id: { type: "string", description: "User ID" },
          first_name: { type: "string", description: "User's first name" },
          last_name: { type: "string", description: "User's last name" },
          email_addresses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                email_address: { type: "string" },
              },
            },
          },
          created_at: { type: "number", description: "Unix timestamp" },
        },
      },
    },
    required: ["data"],
  },
};

// Tool definition for handling user.updated webhook
export const handleUserUpdatedTool = {
  name: "HANDLE_USER_UPDATED",
  description:
    "Handles user.updated webhook: finds and updates existing person record",
  input_schema: {
    type: "object",
    properties: {
      data: {
        type: "object",
        description:
          "The webhook data payload containing updated user information",
        properties: {
          id: { type: "string", description: "User ID" },
          first_name: { type: "string", description: "User's first name" },
          last_name: { type: "string", description: "User's last name" },
          email_addresses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                email_address: { type: "string" },
              },
            },
          },
          created_at: { type: "number", description: "Unix timestamp" },
        },
      },
    },
    required: ["data"],
  },
};

// Tool definition for handling organization.created webhook
export const handleOrganizationCreatedTool = {
  name: "HANDLE_ORGANIZATION_CREATED",
  description:
    "Handles organization.created webhook: finds creator, extracts domain, updates company with org_id",
  input_schema: {
    type: "object",
    properties: {
      data: {
        type: "object",
        description:
          "The webhook data payload containing organization information",
        properties: {
          id: { type: "string", description: "Organization ID" },
          name: { type: "string", description: "Organization name" },
          created_by: { type: "string", description: "User ID of creator" },
        },
      },
    },
    required: ["data"],
  },
};

// Executor for HANDLE_USER_CREATED tool
export const handleUserCreatedExecutor = async (
  input: any,
  ctx: AgentContext
) => {
  try {
    const { data } = input;
    ctx.logger.info("Processing user.created webhook for user:", data.id);

    // Step 0: Format creation date
    const formatDateResult = await formatDateExecutor(
      { timestamp: data.created_at, format: "short" },
      ctx
    );

    // Step 1: Search for existing person by email
    const findPersonResult = await composio.tools.execute("ATTIO_FIND_RECORD", {
      userId: "default",
      arguments: {
        object_id: "people",
        limit: 1,
        attributes: {
          email_addresses: data.email_addresses[0].email_address,
        },
      },
    });

    let personRecordId;
    // Extract person record ID from search result
    let existingPersonId =
      (findPersonResult.data as any)?.records?.[0]?.id?.record_id || null;

    if (existingPersonId) {
      // Step 2a: Update existing person
      await composio.tools.execute("ATTIO_UPDATE_RECORD", {
        userId: "default",
        arguments: {
          object_type: "people",
          record_id: existingPersonId,
          values: {
            email_addresses: [
              { email_address: data.email_addresses[0].email_address },
            ],
            name: {
              first_name: data.first_name,
              last_name: data.last_name,
              full_name: `${data.first_name} ${data.last_name}`,
            },
            user_id: data.id,
            account_creation_date: formatDateResult,
          },
        },
      });
      personRecordId = existingPersonId;
      ctx.logger.info("Updated existing person:", personRecordId);
    } else {
      // Step 2b: Create new person
      const createResult = await composio.tools.execute("ATTIO_CREATE_RECORD", {
        userId: "default",
        arguments: {
          object_type: "people",
          values: {
            email_addresses: [
              { email_address: data.email_addresses[0].email_address },
            ],
            name: {
              first_name: data.first_name,
              last_name: data.last_name,
              full_name: `${data.first_name} ${data.last_name}`,
            },
            user_id: data.id,
            account_creation_date: formatDateResult,
          },
        },
      });
      personRecordId = (createResult.data as any)?.id?.record_id || null;
      ctx.logger.info("Created new person:", personRecordId);
    }

    // Step 3: Handle company creation for business domains
    const email = data.email_addresses[0].email_address;
    const domain = email.split("@")[1];

    const personalDomains = new Set([
      "gmail.com",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
      "aol.com",
      "icloud.com",
      "protonmail.com",
      "zoho.com",
      "mail.com",
      "yandex.com",
      "live.com",
      "msn.com",
      "rediffmail.com",
      "inbox.com",
      "fastmail.com",
      "tutanota.com",
      "gmx.com",
      "mail.ru",
      "qq.com",
      "163.com",
      "126.com",
    ]);

    if (!personalDomains.has(domain)) {
      // Find existing company by domain
      const findCompanyResult = await composio.tools.execute(
        "ATTIO_FIND_RECORD",
        {
          userId: "default",
          arguments: {
            object_id: "companies",
            limit: 1,
            attributes: {
              domains: domain,
            },
          },
        }
      );

      let companyRecordId =
        (findCompanyResult.data as any)?.records?.[0]?.id?.record_id || null;

      if (!companyRecordId) {
        // Create new company
        const companyName = domain.split(".")[0];
        const capitalizedName =
          companyName.charAt(0).toUpperCase() + companyName.slice(1);

        const createCompanyResult = await composio.tools.execute(
          "ATTIO_CREATE_RECORD",
          {
            userId: "default",
            arguments: {
              object_type: "companies",
              values: {
                name: capitalizedName,
                domains: [{ domain: domain }],
              },
            },
          }
        );
        companyRecordId =
          (createCompanyResult.data as any)?.id?.record_id || null;
        ctx.logger.info("Created new company for domain:", domain);
      } else {
        ctx.logger.info("Company already exists for domain:", domain);
      }
    } else {
      ctx.logger.info(
        "Skipping company creation for personal email domain:",
        domain
      );
    }

    // Step 4: Send Slack notification and STOP
    await composio.tools.execute("SLACKBOT_SEND_MESSAGE", {
      userId: "default",
      arguments: {
        channel: "#yay",
        text: `:catshake: ${data.first_name} ${data.last_name} \`${data.id}\` signed up with ${data.email_addresses[0].email_address} :spinningparrot:`,
      },
    });

    ctx.logger.info(
      "Sent Slack notification for user.created, workflow complete"
    );

    return {
      success: true,
      message: "User created workflow completed successfully",
      personRecordId,
    };
  } catch (error: any) {
    ctx.logger.error("Error in handleUserCreatedExecutor:", error);
    return {
      success: false,
      error: `Error processing user.created webhook: ${error.message}`,
    };
  }
};

// Executor for HANDLE_USER_UPDATED tool
export const handleUserUpdatedExecutor = async (
  input: any,
  ctx: AgentContext
) => {
  try {
    const { data } = input;
    ctx.logger.info("Processing user.updated webhook for user:", data.id);

    // Step 0: Format creation date
    const formatDateResult = await formatDateExecutor(
      { timestamp: data.created_at, format: "short" },
      ctx
    );

    // Step 1: Find the person (try by user_id first, then email as per original rules)
    let findPersonResult = await composio.tools.execute("ATTIO_FIND_RECORD", {
      userId: "default",
      arguments: {
        object_id: "people",
        limit: 1,
        attributes: {
          user_id: data.id,
        },
      },
    });

    let personRecordId =
      (findPersonResult.data as any)?.records?.[0]?.id?.record_id || null;

    if (!personRecordId) {
      // If fails: Try by email as per original rules
      findPersonResult = await composio.tools.execute("ATTIO_FIND_RECORD", {
        userId: "default",
        arguments: {
          object_id: "people",
          limit: 1,
          attributes: {
            email_addresses: data.email_addresses[0].email_address,
          },
        },
      });
      personRecordId =
        (findPersonResult.data as any)?.records?.[0]?.id?.record_id || null;
    }

    if (!personRecordId) {
      // If both fail: ABORT with error message as per original rules
      throw new Error(
        `Person not found with user_id: ${data.id} or email: ${data.email_addresses[0].email_address}`
      );
    }

    // Step 3: Update person record
    await composio.tools.execute("ATTIO_UPDATE_RECORD", {
      userId: "default",
      arguments: {
        object_type: "people",
        record_id: personRecordId,
        values: {
          email_addresses: [
            { email_address: data.email_addresses[0].email_address },
          ],
          name: {
            first_name: data.first_name,
            last_name: data.last_name,
            full_name: `${data.first_name} ${data.last_name}`,
          },
          user_id: data.id,
          account_creation_date: formatDateResult,
        },
      },
    });

    ctx.logger.info("Updated person record:", personRecordId);

    return {
      success: true,
      message: "User updated workflow completed successfully",
      personRecordId,
    };
  } catch (error: any) {
    ctx.logger.error("Error in handleUserUpdatedExecutor:", error);
    return {
      success: false,
      error: `Error processing user.updated webhook: ${error.message}`,
    };
  }
};

// Executor for HANDLE_ORGANIZATION_CREATED tool
export const handleOrganizationCreatedExecutor = async (
  input: any,
  ctx: AgentContext
) => {
  try {
    const { data } = input;
    ctx.logger.info(
      "Processing organization.created webhook for org:",
      data.id
    );

    // Step 1: Find creator person with exponential backoff (following original rules)
    let creatorPerson = null;
    const maxAttempts = 3;
    const delays = [0, 2000, 5000, 10000]; // 0s, 2s, 5s as per original

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        ctx.logger.info(
          `Waiting ${delays[attempt]}ms before attempt ${attempt + 1}`
        );
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }

      try {
        const findPersonResult = await composio.tools.execute(
          "ATTIO_FIND_RECORD",
          {
            userId: "default",
            arguments: {
              object_id: "people",
              limit: attempt === 2 ? 10 : 1, // Broader search on final attempt as per original
              attributes: {
                user_id: data.created_by,
              },
            },
          }
        );

        if ((findPersonResult.data as any)?.records?.length > 0) {
          creatorPerson = (findPersonResult.data as any).records[0];
          ctx.logger.info(
            `Found creator on attempt ${attempt + 1}:`,
            creatorPerson.id
          );
          break;
        }
      } catch (error) {
        ctx.logger.warn(`Attempt ${attempt + 1} failed:`, error);
      }
    }

    if (!creatorPerson) {
      // At this point you could also check...
      // Try extracting email from organization metadata (if available in data.members or data.creator_email)
      // Use exact error message from original rules
      throw new Error(
        `Creator not found with user_id: ${data.created_by} after 3 attempts with backoff. Both events fired simultaneously - person record may not be indexed yet.`
      );
    }

    // Step 2: Extract domain from creator's email (following original validation rules)
    const creatorEmail =
      creatorPerson.values?.email_addresses?.[0]?.email_address;
    if (!creatorEmail) {
      throw new Error("Creator email not found in person record");
    }

    const domain = creatorEmail.split("@")[1];
    if (!domain || !domain.includes(".")) {
      throw new Error(`Invalid domain extracted: ${domain}`);
    }

    ctx.logger.info(
      `Found creator email: ${creatorEmail}, extracted domain: ${domain}`
    );

    // Step 3: Find company with retry logic (following original retry pattern)
    let companyRecord = null;
    const companyDelays = [0, 2000, 3000, 10000]; // 0s, 2s, 3s as per original

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        ctx.logger.info(
          `Waiting ${companyDelays[attempt]}ms before company search attempt ${
            attempt + 1
          }`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, companyDelays[attempt])
        );
      }

      try {
        let findCompanyResult;

        if (attempt < 2) {
          // First two attempts: search by domain as per original rules
          findCompanyResult = await composio.tools.execute(
            "ATTIO_FIND_RECORD",
            {
              userId: "default",
              arguments: {
                object_id: "companies",
                limit: attempt === 1 ? 10 : 1, // Broader search on second attempt
                attributes: {
                  domains: domain,
                },
              },
            }
          );
        } else {
          // Final attempt: search by derived company name as per original rules
          const companyName = domain.split(".")[0];
          const capitalizedName =
            companyName.charAt(0).toUpperCase() + companyName.slice(1);
          findCompanyResult = await composio.tools.execute(
            "ATTIO_FIND_RECORD",
            {
              userId: "default",
              arguments: {
                object_id: "companies",
                limit: 5,
                attributes: {
                  name: capitalizedName,
                },
              },
            }
          );
        }

        if ((findCompanyResult.data as any)?.records?.length > 0) {
          companyRecord = (findCompanyResult.data as any).records[0];
          ctx.logger.info(
            `Found company on attempt ${attempt + 1}:`,
            companyRecord.id
          );
          break;
        }
      } catch (error) {
        ctx.logger.warn(`Company search attempt ${attempt + 1} failed:`, error);
      }
    }

    if (!companyRecord) {
      // Use exact error message from original rules
      throw new Error(
        `Company not found for domain: ${domain} after 3 attempts. Company may not be indexed yet from simultaneous user.created event.`
      );
    }

    // Step 4: Update company with org_id (with validation and retry - following original logic exactly)
    let currentOrgId = companyRecord.values?.org_id;

    // Handle different org_id formats as per original rules
    if (typeof currentOrgId === "object") {
      if (currentOrgId?.value) currentOrgId = currentOrgId.value;
      else if (currentOrgId?.id) currentOrgId = currentOrgId.id;
      else if (Array.isArray(currentOrgId)) currentOrgId = currentOrgId[0];
    }

    if (!currentOrgId) {
      // Empty org_id, update with new org as per original rules
      ctx.logger.info(
        `Adding org_id ${data.id} to company ${companyRecord.id}`
      );

      try {
        await composio.tools.execute("ATTIO_UPDATE_RECORD", {
          userId: "default",
          arguments: {
            object_type: "companies",
            record_id: companyRecord.id.record_id,
            values: {
              org_id: data.id,
            },
          },
        });
        ctx.logger.info("Successfully updated company with org_id");
      } catch (error) {
        // Retry once after 1 second as per original rules
        ctx.logger.warn("Company update failed, retrying in 1 second:", error);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        await composio.tools.execute("ATTIO_UPDATE_RECORD", {
          userId: "default",
          arguments: {
            object_type: "companies",
            record_id: companyRecord.id.record_id,
            values: {
              org_id: data.id,
            },
          },
        });
        ctx.logger.info("Successfully updated company with org_id on retry");
      }
    } else if (currentOrgId === data.id) {
      // Use exact log messages from original rules
      ctx.logger.info(
        `Company ${companyRecord.id.record_id} already has org_id: ${currentOrgId}. Skipping update.`
      );
    } else {
      // Use exact log messages from original rules
      ctx.logger.info(
        `Company ${companyRecord.id.record_id} already has different org_id: ${currentOrgId}. Keeping first org.`
      );
    }

    ctx.logger.info("Organization.created workflow completed successfully");

    return {
      success: true,
      message: "Organization created workflow completed successfully",
      companyRecordId: companyRecord.id.record_id,
    };
  } catch (error: any) {
    ctx.logger.error("Error in handleOrganizationCreatedExecutor:", error);
    return {
      success: false,
      error: `Error processing organization.created webhook: ${error.message}`,
    };
  }
};

// Export all tools and executors
export const extraTools = [
  formatDateTool,
  handleUserCreatedTool,
  handleUserUpdatedTool,
  handleOrganizationCreatedTool,
];

export const customToolExecutors = {
  FORMAT_DATE: formatDateExecutor,
  HANDLE_USER_CREATED: handleUserCreatedExecutor,
  HANDLE_USER_UPDATED: handleUserUpdatedExecutor,
  HANDLE_ORGANIZATION_CREATED: handleOrganizationCreatedExecutor,
};
