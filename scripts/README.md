# Backfill Scripts

## User Backfill Script

The `backfill-users.ts` script synchronizes all Clerk users to Attio, ensuring every user has a corresponding person record with their `user_id` populated.

### What it does:

1. **Fetches all users from Clerk** (in batches of 100)
2. **For each user:**
   - Checks if a person record exists in Attio (by email)
   - If **not found**: Creates a new person record
   - If **found but missing user_id**: Updates the record with the user_id
   - If **found with correct user_id**: Skips (already synced)

### Prerequisites:

1. **Environment Variables:**
   ```bash
   ATTIO_API_KEY=your_attio_api_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

### Usage:

```bash
# Run the backfill script
bun run backfill-users

# Or directly
bun run scripts/backfill-users.ts
```

### Output:

The script provides detailed logging:
- Progress updates for each batch
- Individual user processing status
- Final summary with counts of created/updated/skipped/errors

### Rate Limiting:

- 100ms delay between individual user processing
- 500ms delay between batches
- Handles Attio API errors gracefully

### Example Output:

```
🚀 Starting Clerk to Attio user backfill...
📦 Fetching users 1-100...
   Found 100 users in this batch
   👤 Processing user: john@example.com (user_123)
      ✨ Creating new person in Attio...
      ✅ Created successfully
   👤 Processing user: jane@example.com (user_456)
      🔄 Updating existing person (current user_id: none)...
      ✅ Updated successfully

🎉 Backfill complete!
📊 Summary:
   Total processed: 250
   Created: 150
   Updated: 75
   Skipped: 20
   Errors: 5
```

## Company Org Backfill Script

The `backfill-company-orgs.ts` script updates companies in Attio that don't have an `org_id` by finding the most appropriate Clerk organization based on their users.

### What it does:

1. **Fetches all companies from Attio** that have no `org_id`
2. **For each company:**
   - Finds all people (users) with email addresses matching the company's domain(s)
   - Gets each user's Clerk organization memberships
   - Fetches organization details from Clerk (including member counts)
   - Selects the organization with the highest total member count
   - Updates the company's `org_id` in Attio

### Prerequisites:

Same as the user backfill script:
- `ATTIO_API_KEY` environment variable
- `CLERK_SECRET_KEY` environment variable
- Dependencies installed with `bun install`

### Usage:

```bash
# Run the backfill script
bun run backfill-company-orgs

# Or run in dry-run mode to see what would change
bun run backfill-company-orgs --dry-run
```

### Logic:

The script assumes that the organization with the most members is the "main" company organization, as opposed to personal single-user organizations that Agentuity creates for each user.

### Example Output:

```
🚀 Starting company org_id backfill...
==================================================

📋 Fetching companies without org_id...
✅ Found 25 companies without org_id

🏢 Processing company: Acme Corp (rec_abc123)
   Domains: acme.com
   Found 5 unique users with Clerk IDs
      👤 Checking orgs for john@acme.com (user_123)...
         Found 1 org(s)
      👤 Checking orgs for jane@acme.com (user_456)...
         Found 1 org(s)

   📊 Fetching details for 2 organization(s)...
      Acme Corp Team: 15 total members (5 from this company)
      John's Personal Org: 1 total members (1 from this company)

   ✨ Selected org: Acme Corp Team (org_789) with 15 members
   🔄 Updating company org_id...
   ✅ Updated successfully!

==================================================
🎉 Backfill complete!
📊 Summary:
   Total processed: 25
   Updated: 20
   Skipped: 4
   Errors: 1
```