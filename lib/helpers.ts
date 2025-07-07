// Helper function to convert date strings to Date objects
export function convertDatesToObjects(args: Record<string, any>): Record<string, any> {
    const convertedArgs = { ...args };
    
    // List of date field names that might need conversion
    const dateFields = [
      'firstEmailInteraction',
      'lastEmailInteraction', 
      'firstCalendarInteraction',
      'nextCalendarInteraction',
      'lastCalendarInteraction'
    ];
    
    for (const field of dateFields) {
      if (convertedArgs[field] && typeof convertedArgs[field] === 'string') {
        convertedArgs[field] = new Date(convertedArgs[field]);
      }
    }
    
    return convertedArgs;
  }