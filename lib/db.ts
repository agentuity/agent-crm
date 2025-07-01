import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: "require" });
export const db = drizzle(client);

import { eq, desc } from "drizzle-orm";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const attioMockup = pgTable("attio_mockup", {
  recordId: serial("record_id").primaryKey(),
  name: text("name").notNull(),
  emailAddress: text("email_address").notNull().unique(),
  firstEmailInteraction: timestamp("first_email_interaction"),
  lastEmailInteraction: timestamp("last_email_interaction"),
});

export async function addPerson(
  name: string,
  emailAddress: string,
  firstEmailInteraction?: Date,
  lastEmailInteraction?: Date
) {
  await db.insert(attioMockup).values({
    name,
    emailAddress,
    firstEmailInteraction: firstEmailInteraction ?? null,
    lastEmailInteraction: lastEmailInteraction ?? null,
  });
}

export async function getPeople(limit = 10) {
  return db
    .select()
    .from(attioMockup)
    .orderBy(desc(attioMockup.recordId))
    .limit(limit);
}

export async function updatePersonByEmail(
  emailAddress: string,
  updates: {
    name?: string;
    firstEmailInteraction?: Date | null;
    lastEmailInteraction?: Date | null;
  }
) {
  await db
    .update(attioMockup)
    .set({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.firstEmailInteraction !== undefined && {
        firstEmailInteraction: updates.firstEmailInteraction,
      }),
      ...(updates.lastEmailInteraction !== undefined && {
        lastEmailInteraction: updates.lastEmailInteraction,
      }),
    })
    .where(eq(attioMockup.emailAddress, emailAddress));
}

export async function getPersonByEmail(emailAddress: string) {
  return db
    .select()
    .from(attioMockup)
    .where(eq(attioMockup.emailAddress, emailAddress))
    .limit(1);
}
