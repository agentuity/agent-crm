import type { AgentContext } from "@agentuity/sdk";

// Tool definition for the LLM
export const formatDateTool = {
  name: "FORMAT_DATE",
  description: "Converts a Unix timestamp (milliseconds or seconds) to a formatted date string",
  input_schema: {
    type: "object",
    properties: {
      timestamp: {
        type: "number",
        description: "Unix timestamp in milliseconds or seconds"
      },
      format: {
        type: "string",
        description: "Date format: 'short' (Aug 6, 2025), 'long' (August 6, 2025), 'iso' (2025-08-06)",
        enum: ["short", "long", "iso"],
        default: "short"
      }
    },
    required: ["timestamp"]
  }
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
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
      
      case "long":
        // "August 6, 2025"
        return date.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
      
      case "iso":
        // "2025-08-06"
        return date.toISOString().split('T')[0];
      
      default:
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
    }
  } catch (error: any) {
    ctx.logger.error("Date formatting error:", error);
    return `Error formatting date: ${error.message}`;
  }
};

// Export all tools and executors
export const extraTools = [formatDateTool];

export const customToolExecutors = {
  FORMAT_DATE: formatDateExecutor
};
