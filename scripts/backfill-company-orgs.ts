#!/usr/bin/env bun
import { clerkClient } from '@clerk/clerk-sdk-node';

// Configuration
const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!ATTIO_API_KEY) {
  console.error('ATTIO_API_KEY environment variable is required');
  process.exit(1);
}

if (!CLERK_SECRET_KEY) {
  console.error('CLERK_SECRET_KEY environment variable is required');
  process.exit(1);
}

// Types
interface AttioCompany {
  id: {
    object_id: string;
    record_id: string;
  } | string;
  values: {
    name?: string | Array<{ name: string }> | { name: string };
    domains?: Array<{ domain: string }>;
    org_id?: string | { value: string } | string[];
  };
}

interface AttioPerson {
  id: {
    object_id: string;
    record_id: string;
  } | string;
  values: {
    email_addresses?: Array<{ email_address: string }>;
    user_id?: string | { value: string } | string[];
    name?: Array<{ full_name: string }>;
  };
}

// Attio API helper
class AttioAPI {
  private baseURL = 'https://api.attio.com/v2';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Attio API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  async findCompaniesWithoutOrgId(offset: number = 0, limit: number = 100): Promise<AttioCompany[]> {
    try {
      const response = await this.request('/objects/companies/records/query', {
        method: 'POST',
        body: JSON.stringify({
          limit,
          offset,
        })
      }) as { data?: AttioCompany[] };

      // Filter companies without org_id
      const companies = response.data || [];
      return companies.filter((company: AttioCompany) => {
        const orgId = company.values?.org_id;
        
        // Check if org_id is empty/null/undefined
        if (!orgId) return true;
        
        // Handle different formats
        if (typeof orgId === 'string' && orgId.length === 0) return true;
        if (Array.isArray(orgId) && orgId.length === 0) return true;
        if (typeof orgId === 'object' && 'value' in orgId && orgId.value === '') return true;
        
        return false;
      });
    } catch (error) {
      console.error('Error finding companies:', error);
      return [];
    }
  }

  async findPeopleByDomain(domain: string): Promise<AttioPerson[]> {
    try {
      console.log(`      🔍 Searching for people with @${domain}...`);
      
      // We'll need to get all people and filter client-side since Attio doesn't support domain filtering
      const allPeople: AttioPerson[] = [];
      let offset = 0;
      const limit = 100;
      
      while (true) {
        const response = await this.request('/objects/people/records/query', {
          method: 'POST',
          body: JSON.stringify({
            limit,
            offset,
          })
        }) as { data?: AttioPerson[] };
        
        const people = response.data || [];
        if (people.length === 0) break;
        
        // Filter people with matching domain
        const matchingPeople = people.filter((person: AttioPerson) => {
          const emails = person.values?.email_addresses || [];
          return emails.some(emailObj => 
            emailObj.email_address && emailObj.email_address.toLowerCase().endsWith(`@${domain.toLowerCase()}`)
          );
        });
        
        allPeople.push(...matchingPeople);
        
        // If we got less than limit, we're done
        if (people.length < limit) break;
        offset += limit;
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return allPeople;
    } catch (error) {
      console.error(`Error finding people for domain ${domain}:`, error);
      return [];
    }
  }

  async updateCompanyOrgId(recordId: string, orgId: string) {
    return this.request(`/objects/companies/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          values: {
            org_id: orgId
          }
        }
      })
    });
  }
}

// Helper to extract org_id value from different formats
function extractOrgId(orgIdField: any): string | null {
  if (!orgIdField) return null;
  
  if (typeof orgIdField === 'string' && orgIdField.length > 0) {
    return orgIdField;
  }
  
  if (Array.isArray(orgIdField) && orgIdField.length > 0) {
    const firstValue = orgIdField[0];
    if (typeof firstValue === 'string') return firstValue;
    if (firstValue?.value) return firstValue.value;
  }
  
  if (typeof orgIdField === 'object' && orgIdField.value) {
    return orgIdField.value;
  }
  
  return null;
}

// Get user's organizations from Clerk
async function getUserOrganizations(userId: string): Promise<string[]> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const orgMemberships = await clerkClient.users.getOrganizationMembershipList({ userId });
    
    return orgMemberships.data.map(membership => membership.organization.id);
  } catch (error) {
    console.error(`Error fetching orgs for user ${userId}:`, error);
    return [];
  }
}

// Get organization details from Clerk
async function getOrganizationDetails(orgId: string) {
  try {
    const org = await clerkClient.organizations.getOrganization({ organizationId: orgId });
    
    // Get member count by fetching the membership list
    const membershipList = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 1 // We only need the total count
    });
    
    const memberCount = membershipList.totalCount || 0;
    
    return {
      id: org.id,
      name: org.name,
      membersCount: memberCount,
      createdAt: org.createdAt,
    };
  } catch (error) {
    console.error(`Error fetching org details for ${orgId}:`, error);
    return null;
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('🏃 Running in DRY-RUN mode - no changes will be made\n');
  }

  console.log('🚀 Starting company org_id backfill...');
  console.log('=' .repeat(50));

  const attio = new AttioAPI(ATTIO_API_KEY!);
  
  const stats = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Get all companies without org_id
    console.log('\n📋 Fetching companies without org_id...');
    const companiesWithoutOrgId: AttioCompany[] = [];
    let offset = 0;
    
    while (true) {
      const batch = await attio.findCompaniesWithoutOrgId(offset, 100);
      companiesWithoutOrgId.push(...batch);
      
      if (batch.length < 100) break;
      offset += 100;
      console.log(`   Found ${companiesWithoutOrgId.length} companies so far...`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`\n✅ Found ${companiesWithoutOrgId.length} companies without org_id`);
    
    // Process each company
    for (const company of companiesWithoutOrgId) {
      stats.processed++;
      
      // Handle company name which might be an array
      let companyName = 'Unknown';
      const nameField = company.values?.name;
      
      if (nameField) {
        if (Array.isArray(nameField) && nameField.length > 0) {
          const firstItem = nameField[0];
          if (typeof firstItem === 'string') {
            companyName = firstItem;
          } else if (firstItem && typeof firstItem === 'object' && 'value' in firstItem) {
            companyName = (firstItem as any).value;
          }
        } else if (typeof nameField === 'string') {
          companyName = nameField;
        } else if (typeof nameField === 'object' && 'value' in nameField) {
          companyName = (nameField as any).value;
        }
      }
      const domains = company.values?.domains || [];
      const recordId = typeof company.id === 'string' ? company.id : company.id?.record_id;
      
      console.log(`\n🏢 Processing company: ${companyName} (${recordId})`);
      console.log(`   Domains: ${domains.map(d => d.domain).join(', ')}`);
      
      if (domains.length === 0) {
        console.log('   ⚠️  No domains found, skipping...');
        stats.skipped++;
        continue;
      }
      
      // Get all users for this company's domains
      const allUsers: AttioPerson[] = [];
      for (const domainObj of domains) {
        const domain = domainObj.domain;
        const users = await attio.findPeopleByDomain(domain);
        allUsers.push(...users);
      }
      
      // Deduplicate users by user_id
      const uniqueUsers = new Map<string, AttioPerson>();
      for (const user of allUsers) {
        const userIdField = user.values?.user_id;
        let userId: string | null = null;
        
        // Extract user_id from various formats
        if (userIdField !== undefined && userIdField !== null) {
          if (typeof userIdField === 'string' && userIdField.length > 0) {
            userId = userIdField;
          } else if (Array.isArray(userIdField) && userIdField.length > 0) {
            const firstValue = userIdField[0];
            if (typeof firstValue === 'string') {
              userId = firstValue;
            } else if (firstValue && typeof firstValue === 'object' && 'value' in firstValue) {
              userId = (firstValue as any).value;
            }
          } else if (typeof userIdField === 'object' && 'value' in userIdField) {
            userId = (userIdField as any).value;
          }
        }
        
        if (userId) {
          uniqueUsers.set(userId, user);
        }
      }
      
      console.log(`   Found ${uniqueUsers.size} unique users with Clerk IDs`);
      
      if (uniqueUsers.size === 0) {
        console.log('   ⚠️  No users with Clerk IDs found, skipping...');
        stats.skipped++;
        continue;
      }
      
      // Collect all organizations these users belong to
      const orgCandidates = new Map<string, { count: number; details?: any }>();
      
      for (const [userId, user] of uniqueUsers) {
        const userEmail = user.values?.email_addresses?.[0]?.email_address || 'unknown';
        console.log(`      👤 Checking orgs for ${userEmail} (${userId})...`);
        
        const userOrgs = await getUserOrganizations(userId);
        console.log(`         Found ${userOrgs.length} org(s)`);
        
        // Add orgs to candidates
        for (const orgId of userOrgs) {
          if (!orgCandidates.has(orgId)) {
            orgCandidates.set(orgId, { count: 0 });
          }
          orgCandidates.get(orgId)!.count++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (orgCandidates.size === 0) {
        console.log('   ⚠️  No organizations found for any users, skipping...');
        stats.skipped++;
        continue;
      }
      
      // Get details for each org candidate
      console.log(`\n   📊 Fetching details for ${orgCandidates.size} organization(s)...`);
      for (const [orgId, data] of orgCandidates) {
        const details = await getOrganizationDetails(orgId);
        if (details) {
          data.details = details;
          console.log(`      ${details.name}: ${details.membersCount} total members (${data.count} from this company)`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Select the org with most members
      let bestOrg: { id: string; details: any } | null = null;
      let highestMemberCount = 0;
      
      for (const [orgId, data] of orgCandidates) {
        if (data.details && data.details.membersCount > highestMemberCount) {
          highestMemberCount = data.details.membersCount;
          bestOrg = { id: orgId, details: data.details };
        }
      }
      
      if (!bestOrg) {
        console.log('   ❌ Could not determine best organization, skipping...');
        stats.skipped++;
        continue;
      }
      
      console.log(`\n   ✨ Selected org: ${bestOrg.details.name} (${bestOrg.id}) with ${bestOrg.details.membersCount} members`);
      
      // Update the company
      if (!isDryRun) {
        try {
          console.log(`   🔄 Updating company org_id...`);
          await attio.updateCompanyOrgId(recordId, bestOrg.id);
          console.log('   ✅ Updated successfully!');
          stats.updated++;
        } catch (error) {
          console.error('   ❌ Failed to update:', error);
          stats.errors++;
        }
      } else {
        console.log('   🏃 [DRY RUN] Would update company org_id to:', bestOrg.id);
        stats.updated++;
      }
      
      // Add delay between companies
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Backfill complete!');
  console.log('📊 Summary:');
  console.log(`   Total processed: ${stats.processed}`);
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Skipped: ${stats.skipped}`);
  console.log(`   Errors: ${stats.errors}`);
  
  if (isDryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to apply changes.');
  }
}

// Run the script
main().catch(console.error);