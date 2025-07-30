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