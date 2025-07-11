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

// --- Organization ID String Manipulation Helpers ---

// Helper function to parse orgId string into array of {name, id} objects
export function parseOrgIdString(orgIdString: string | null | undefined): Array<{name: string, id: string}> {
  if (!orgIdString || typeof orgIdString !== 'string' || orgIdString.trim() === '') return [];
  
  return orgIdString.split('|').map(part => {
    const [name, id] = part.split(':');
    return { name: name?.trim() || '', id: id?.trim() || '' };
  }).filter(org => org.name && org.id);
}

// Helper function to convert array of orgs back to string format
export function formatOrgIdString(orgs: Array<{name: string, id: string}>): string {
  return orgs.map(org => `${org.name}:${org.id}`).join('|');
}

// Helper function to add org to existing orgId string (avoiding duplicates)
export function addOrgToOrgIdString(existingOrgIdString: string | null | undefined, newOrgName: string, newOrgId: string): string {
  const existingOrgs = parseOrgIdString(existingOrgIdString);
  
  // Check if org ID already exists
  const existsAlready = existingOrgs.some(org => org.id === newOrgId);
  if (existsAlready) {
    return existingOrgIdString || ''; // Return empty string if null/undefined
  }
  
  // Add new org
  existingOrgs.push({ name: newOrgName, id: newOrgId });
  return formatOrgIdString(existingOrgs);
}