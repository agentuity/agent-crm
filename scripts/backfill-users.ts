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

  async findPersonByEmail(email: string) {
    try {
      console.log(`      🔍 Searching for ${email} in Attio...`);
      
      // First, try a targeted search using Attio's filter
      try {
        const filterResponse = await this.request('/objects/people/records/query', {
          method: 'POST',
          body: JSON.stringify({
            filter: {
              email_addresses: email
            }
          })
        }) as { data?: any[] };
        
        if (filterResponse.data && filterResponse.data.length > 0) {
          console.log(`      ✨ Found ${filterResponse.data.length} people via filtered search`);
          const allPeople = filterResponse.data;
          // Continue with existing logic below...
        }
      } catch (filterError) {
        console.log(`      ⚠️  Filter search failed, falling back to full scan: ${filterError}`);
      }
      
      // Fallback: Get ALL people with pagination to ensure we find them
      let allPeople: any[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore && allPeople.length < 5000) { // Increased safety limit for larger datasets
        const response = await this.request('/objects/people/records/query', {
          method: 'POST',
          body: JSON.stringify({
            limit,
            offset
          })
        }) as { data?: any[] };
        
        const batch = response.data || [];
        allPeople.push(...batch);
        hasMore = batch.length === limit;
        offset += limit;

        console.log(`         📦 Checked ${allPeople.length} people so far...`);
      }
      
      console.log(`      📊 Total people in Attio: ${allPeople.length}`);
      
      // Filter results to find ALL matching emails (in case of duplicates)
      const matchingPeople = allPeople.filter(p => {
        const emails = p.values?.email_addresses || [];
        return emails.some((emailObj: any) => 
          emailObj.email_address && emailObj.email_address.toLowerCase() === email.toLowerCase()
        );
      });
      
      console.log(`      📊 Found ${matchingPeople.length} people with email ${email}`);
      
      // Log all matches for debugging
      matchingPeople.forEach((p, index) => {
        const currentUserId = p.values?.user_id;
        let userIdValue = 'MISSING';
        if (currentUserId !== undefined && currentUserId !== null) {
          if (typeof currentUserId === 'string' && currentUserId.length > 0) {
            userIdValue = currentUserId;
          } else if (Array.isArray(currentUserId)) {
            if (currentUserId.length === 0) {
              userIdValue = 'EMPTY_ARRAY';
            } else {
              // Handle array structure
              const firstValue = currentUserId[0];
              if (typeof firstValue === 'string') {
                userIdValue = firstValue;
              } else if (firstValue?.value) {
                userIdValue = firstValue.value;
              } else {
                userIdValue = JSON.stringify(currentUserId);
              }
            }
          } else if (currentUserId.value) {
            userIdValue = currentUserId.value;
          } else {
            userIdValue = JSON.stringify(currentUserId);
          }
        }
        
        const recordId = p.id?.record_id || p.id?.value || p.id;
        const name = p.values?.name?.[0]?.full_name || 'No name';
        console.log(`        ${index + 1}. Record ID: ${recordId}, Name: ${name}, User ID: ${userIdValue}`);
      });
      
      // Use the first match (or null if no matches)
      const person = matchingPeople[0] || null;
      
      if (!person) {
        console.log(`      ❌ No match found for ${email}`);
      }
      
      return person || null;
    } catch (error) {
      console.error(`Error finding person by email ${email}:`, error);
      return null;
    }
  }

  async createPerson(userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    userId: string;
    createdAt: string;
  }) {
    const values: any = {
      email_addresses: [{ email_address: userData.email }],
      user_id: userData.userId,
      account_creation_date: userData.createdAt,
    };

    if (userData.firstName || userData.lastName) {
      values.name = {
        first_name: userData.firstName || '',
        last_name: userData.lastName || '',
        full_name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
      };
    }

    return this.request('/objects/people/records', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          values
        }
      })
    });
  }

  async updatePerson(recordId: string, userData: {
    email: string;
    firstName?: string;
    lastName?: string;
    userId: string;
    createdAt: string;
  }) {
    // SAFE UPDATE: Only update user_id, preserve existing name/email data
    const values: any = {
      user_id: userData.userId,
    };

    return this.request(`/objects/people/records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          values
        }
      })
    });
  }
}

async function testConnections() {
  console.log('🧪 Testing API connections and data structure...\n');
  
  const attio = new AttioAPI(ATTIO_API_KEY!);
  
  // Test Attio - get first 10 people
  console.log('📋 Testing Attio API - fetching first 10 people...');
  try {
    const response = await attio.request('/objects/people/records/query', {
      method: 'POST',
      body: JSON.stringify({
        limit: 10
      })
    }) as { data?: any[] };
    
    const people = response.data?.slice(0, 10) || [];
    console.log(`   ✅ Found ${people.length} people in Attio`);
    
    if (people.length > 0) {
      console.log('\n   📊 First 10 people in Attio:');
      people.forEach((person, index) => {
        console.log(`   ${index + 1}. Email: ${person.values?.email_addresses?.[0]?.email_address || 'none'}`);
        const nameRecord = person.values?.name?.[0]; // Get first name record from array
        console.log(`      Name: ${nameRecord?.full_name || 'none'}`);
        console.log(`      User ID: ${person.values?.user_id || 'MISSING'}`);
        console.log(`      ID: ${person.id?.value || person.id}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('   ❌ Attio API test failed:', error);
    return false;
  }
  
  // Test Clerk - get first 5 users
  console.log('\n👥 Testing Clerk API - fetching first 5 users...');
  try {
    const response = await clerkClient.users.getUserList({ limit: 5 });
    const users = response.data;
    console.log(`   ✅ Found ${users.length} users in Clerk`);
    
    if (users.length > 0) {
      console.log('\n   📊 First 5 users in Clerk:');
      users.forEach((user, index) => {
        const primaryEmail = user.emailAddresses.find((email: any) => email.id === user.primaryEmailAddressId);
        console.log(`   ${index + 1}. Email: ${primaryEmail?.emailAddress || 'none'}`);
        console.log(`      Name: ${user.firstName || ''} ${user.lastName || ''}`);
        console.log(`      User ID: ${user.id}`);
        console.log(`      Created: ${new Date(user.createdAt).toISOString()}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('   ❌ Clerk API test failed:', error);
    return false;
  }
  
  console.log('\n✅ All API connections working! Ready to proceed with backfill.');
  return true;
}

async function main() {
  // Check for dry-run mode
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('🏃 Running in DRY-RUN mode - no changes will be made');
  }
  
  // First test the connections
  const testPassed = await testConnections();
  if (!testPassed) {
    console.log('\n❌ Tests failed. Please check your API keys and try again.');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🚀 Starting Clerk to Attio user backfill...');
  console.log('='.repeat(50));

  const attio = new AttioAPI(ATTIO_API_KEY!);
  
  // Get total counts first
  console.log('\n📊 Getting total counts...');
  
  // Get Clerk total
  const clerkCountResponse = await clerkClient.users.getUserList({ limit: 1 });
  const totalClerkUsers = clerkCountResponse.totalCount || 0;
  console.log(`   Clerk users: ${totalClerkUsers}`);
  
  // Get Attio total (rough estimate)
  let attioTotal = 0;
  let attioOffset = 0;
  while (true) {
    const attioCountResponse = await attio.request('/objects/people/records/query', {
      method: 'POST',
      body: JSON.stringify({ limit: 100, offset: attioOffset })
    }) as { data?: any[] };
    
    const batch = attioCountResponse.data || [];
    attioTotal += batch.length;
    if (batch.length < 100) break;
    attioOffset += 100;
    if (attioTotal > 5000) break; // Safety limit
  }
  console.log(`   Attio people: ${attioTotal}`);
  console.log('');
  
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let totalProcessed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  while (hasMore && totalProcessed < totalClerkUsers) {
    try {
      console.log(`📦 Fetching users ${offset + 1}-${Math.min(offset + limit, totalClerkUsers)}...`);
      
      // Get users from Clerk
      const response = await clerkClient.users.getUserList({
        limit,
        offset,
      });

      const users = response.data;
      const totalCount = response.totalCount;
      hasMore = users.length === limit;

      console.log(`   Found ${users.length} users in this batch (Total in Clerk: ${totalCount || 'unknown'})`);

      for (const user of users) {
        totalProcessed++;
        
        // Get primary email
        const primaryEmail = user.emailAddresses.find((email: any) => email.id === user.primaryEmailAddressId);
        if (!primaryEmail) {
          console.log(`   ⚠️  User ${user.id} has no primary email, skipping...`);
          skipped++;
          continue;
        }

        const email = primaryEmail.emailAddress;
        console.log(`   👤 Processing user: ${email} (${user.id})`);

        try {
          // Check if person exists in Attio
          const existingPerson = await attio.findPersonByEmail(email);

          const userData = {
            email,
            firstName: user.firstName || undefined,
            lastName: user.lastName || undefined,
            userId: user.id,
            createdAt: new Date(user.createdAt).toISOString(),
          };

          if (!existingPerson) {
            // Create new person
            console.log(`      ✨ ${isDryRun ? '[DRY-RUN] Would create' : 'Creating'} new person in Attio...`);
            if (!isDryRun) {
              await attio.createPerson(userData);
              created++;
              console.log(`      ✅ Created successfully`);
            } else {
              console.log(`      🏃 [DRY-RUN] Would have created person with user_id: ${user.id}`);
              created++;
            }
          } else {
            // Check if user_id is missing or different  
            const currentUserId = existingPerson.values?.user_id;
            
            // Extract user_id value properly - handle all possible structures
            let userIdValue = null;
            if (currentUserId !== undefined && currentUserId !== null) {
              if (typeof currentUserId === 'string' && currentUserId.length > 0) {
                userIdValue = currentUserId;
              } else if (Array.isArray(currentUserId)) {
                if (currentUserId.length === 0) {
                  // Empty array means no user_id
                  console.log(`      📝 user_id is empty array, will update`);
                  userIdValue = null;
                } else {
                  // Handle array structure (Attio sometimes returns values as arrays)
                  const firstValue = currentUserId[0];
                  if (typeof firstValue === 'string') {
                    userIdValue = firstValue;
                  } else if (firstValue?.value) {
                    userIdValue = firstValue.value;
                  }
                }
              } else if (currentUserId?.value) {
                userIdValue = currentUserId.value;
              } else {
                console.log(`      ⚠️  Unexpected user_id structure: ${JSON.stringify(currentUserId)}`);
              }
            }
            
            // Extract person ID properly  
            let personId = null;
            if (existingPerson.id) {
              if (typeof existingPerson.id === 'string') {
                personId = existingPerson.id;
              } else if (existingPerson.id.value) {
                personId = existingPerson.id.value;
              } else if (existingPerson.id.record_id) {
                // Handle the complex ID structure with record_id
                personId = existingPerson.id.record_id;
                console.log(`      🔍 Using record_id from complex structure: ${personId}`);
              } else {
                console.log(`      🔍 Person ID structure: ${JSON.stringify(existingPerson.id)}`);
                // As a last resort, try to use the object if it looks like it might work
                personId = existingPerson.id;
              }
            }
            
            if (!personId) {
              console.log(`      ❌ Could not extract person ID, skipping update`);
              skipped++;
              continue;
            }
            
            // Update if user_id is missing or different
            if (!userIdValue || userIdValue !== user.id) {
              console.log(`      🔄 ${isDryRun ? '[DRY-RUN] Would update' : 'Updating'} existing person (current user_id: ${userIdValue || 'MISSING'}) -> ${user.id}...`);
              if (!isDryRun) {
                await attio.updatePerson(personId, userData);
                updated++;
                console.log(`      ✅ Updated successfully with user_id: ${user.id}`);
              } else {
                console.log(`      🏃 [DRY-RUN] Would have updated user_id to: ${user.id}`);
                updated++;
              }
            } else {
              console.log(`      ✓ Person already exists with correct user_id (${userIdValue}), skipping`);
              skipped++;
            }
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`      ❌ Error processing user ${email}:`, error);
          errors++;
        }
      }

      offset += limit;
      
      // Small delay between batches
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error(`❌ Error fetching users from Clerk:`, error);
      break;
    }
  }

  console.log('\n🎉 Backfill complete!');
  console.log(`📊 Summary:`);
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

main().catch(console.error);