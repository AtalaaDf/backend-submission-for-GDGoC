import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { buildApp } from "../../src/app.js";
import { clock } from "../../src/common/clock.js";
import { env } from "../../src/config/env.js";
import { db, queryClient } from "../../src/db/client.js";
import {
  attendances,
  divisions,
  eventRegistrations,
  events,
  members,
  users,
} from "../../src/db/schema.js";

async function checkPostgres(): Promise<boolean> {
  try {
    const probe = postgres(env.DATABASE_URL, { connect_timeout: 1, max: 1 });
    await probe`SELECT 1`;
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const isPostgresAvailable = await checkPostgres();

describe.runIf(isPostgresAvailable)(
  "Integration Tests: Real Database Concurrency & Race Condition Suite",
  () => {
    const app = buildApp();
    let superadminToken: string;
    let testDivisionId: string;
    let testUserId: string;

    beforeAll(async () => {
      await app.ready();

      // Ensure a superadmin user exists for auth tokens
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.role, "superadmin"))
        .limit(1);

      if (existingUser[0]) {
        testUserId = existingUser[0].id;
      } else {
        const insertedUser = await db
          .insert(users)
          .values({
            email: "ci-superadmin@gdgoc-unsri.org",
            passwordHash: "dummyhashforciintegrationtest123",
            fullName: "CI Superadmin",
            role: "superadmin",
            isActive: true,
          })
          .returning();
        testUserId = insertedUser[0]!.id;
      }

      superadminToken = app.jwt.sign({ sub: testUserId, role: "superadmin" });

      // Create test division
      const insertedDiv = await db
        .insert(divisions)
        .values({
          name: `Concurrency Division ${Date.now()}`,
          type: "technical",
        })
        .returning();
      testDivisionId = insertedDiv[0]!.id;
    });

    afterAll(async () => {
      clock.reset();
      // Clean up test division if created
      if (testDivisionId) {
        await db.delete(divisions).where(eq(divisions.id, testDivisionId));
      }
      await queryClient.end();
    });

    it("Quota Concurrency: 15 concurrent requests for 3 quota slots results in exactly 3 successes and 12 rejections", async () => {
      // 1. Create event with quota = 3
      const insertedEvent = await db
        .insert(events)
        .values({
          name: `High-Contention Workshop ${Date.now()}`,
          type: "offline",
          startAt: new Date(Date.now() + 3600000), // starts in 1 hour
          endAt: new Date(Date.now() + 7200000), // ends in 2 hours
          quota: 3,
          createdBy: testUserId,
        })
        .returning();
      const eventId = insertedEvent[0]!.id;

      // 2. Create 15 distinct test members
      const memberInsertPromises = Array.from({ length: 15 }, (_, i) =>
        db
          .insert(members)
          .values({
            fullName: `Concurrent Participant ${i + 1} - ${Date.now()}`,
            divisionId: testDivisionId,
          })
          .returning()
      );
      const insertedMembers = (await Promise.all(memberInsertPromises)).map((m) => m[0]!);

      // 3. Fire 15 simultaneous registration requests
      const registrationPromises = insertedMembers.map((member) =>
        app.inject({
          method: "POST",
          url: `/api/v1/events/${eventId}/registrations`,
          headers: {
            authorization: `Bearer ${superadminToken}`,
          },
          payload: {
            memberId: member.id,
          },
        })
      );

      const responses = await Promise.all(registrationPromises);

      const successResponses = responses.filter((r) => r.statusCode === 201);
      const fullResponses = responses.filter(
        (r) => r.statusCode === 409 && r.json().error.code === "EVENT_FULL"
      );

      // Exactly 3 succeed, exactly 12 rejected with EVENT_FULL
      expect(successResponses.length).toBe(3);
      expect(fullResponses.length).toBe(12);

      // Verify database state: exactly 3 rows in event_registrations
      const registeredRows = await db
        .select()
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventId, eventId));

      expect(registeredRows.length).toBe(3);

      // Clean up event
      await db.delete(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));
      await db.delete(events).where(eq(events.id, eventId));
      for (const m of insertedMembers) {
        await db.delete(members).where(eq(members.id, m.id));
      }
    });

    it("Duplicate Registration Concurrency: 10 concurrent registrations for same member results in exactly 1 success and 9 rejections", async () => {
      // 1. Create event with plenty of quota
      const insertedEvent = await db
        .insert(events)
        .values({
          name: `Duplicate Test Event ${Date.now()}`,
          type: "online",
          startAt: new Date(Date.now() + 3600000),
          endAt: new Date(Date.now() + 7200000),
          quota: 20,
          createdBy: testUserId,
        })
        .returning();
      const eventId = insertedEvent[0]!.id;

      // 2. Create 1 member
      const insertedMember = await db
        .insert(members)
        .values({
          fullName: `Duplicate Candidate ${Date.now()}`,
          divisionId: testDivisionId,
        })
        .returning();
      const memberId = insertedMember[0]!.id;

      // 3. Fire 10 simultaneous registration requests for the same member
      const requests = Array.from({ length: 10 }, () =>
        app.inject({
          method: "POST",
          url: `/api/v1/events/${eventId}/registrations`,
          headers: {
            authorization: `Bearer ${superadminToken}`,
          },
          payload: {
            memberId,
          },
        })
      );

      const responses = await Promise.all(requests);

      const successResponses = responses.filter((r) => r.statusCode === 201);
      const duplicateResponses = responses.filter(
        (r) => r.statusCode === 409 && r.json().error.code === "ALREADY_REGISTERED"
      );

      // Exactly 1 succeeds, exactly 9 rejected
      expect(successResponses.length).toBe(1);
      expect(duplicateResponses.length).toBe(9);

      // Verify database state: exactly 1 row
      const registeredRows = await db
        .select()
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventId, eventId));

      expect(registeredRows.length).toBe(1);

      // Clean up
      await db.delete(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));
      await db.delete(events).where(eq(events.id, eventId));
      await db.delete(members).where(eq(members.id, memberId));
    });

    it("Attendance Idempotency Concurrency: 10 concurrent check-ins result in 1 insert and zero errors", async () => {
      const eventStart = new Date("2026-12-01T10:00:00Z");
      const eventEnd = new Date("2026-12-01T12:00:00Z");

      // Set mock time inside event window
      clock.setMockTime("2026-12-01T10:30:00Z");

      // 1. Create event
      const insertedEvent = await db
        .insert(events)
        .values({
          name: `Attendance Concurrency Event ${Date.now()}`,
          type: "offline",
          startAt: eventStart,
          endAt: eventEnd,
          quota: 10,
          createdBy: testUserId,
        })
        .returning();
      const eventId = insertedEvent[0]!.id;

      // 2. Create member
      const insertedMember = await db
        .insert(members)
        .values({
          fullName: `Attendee Candidate ${Date.now()}`,
          divisionId: testDivisionId,
        })
        .returning();
      const memberId = insertedMember[0]!.id;

      // 3. Register member first
      await db.insert(eventRegistrations).values({
        eventId,
        memberId,
        registeredBy: testUserId,
      });

      // 4. Fire 10 concurrent attendance check-in requests
      const checkInRequests = Array.from({ length: 10 }, () =>
        app.inject({
          method: "POST",
          url: `/api/v1/events/${eventId}/attendances`,
          headers: {
            authorization: `Bearer ${superadminToken}`,
          },
          payload: {
            memberId,
          },
        })
      );

      const responses = await Promise.all(checkInRequests);

      // All responses must be either 201 (first) or 200 (subsequent idempotent)
      const validStatuses = responses.filter((r) => r.statusCode === 201 || r.statusCode === 200);
      expect(validStatuses.length).toBe(10);

      const firstCreated = responses.filter((r) => r.statusCode === 201);
      const idempotentOk = responses.filter((r) => r.statusCode === 200);

      expect(firstCreated.length).toBeGreaterThanOrEqual(1);
      expect(firstCreated.length + idempotentOk.length).toBe(10);

      // Verify database state: exactly 1 attendance row created in table
      const attendanceRows = await db
        .select()
        .from(attendances)
        .where(eq(attendances.eventId, eventId));

      expect(attendanceRows.length).toBe(1);

      // Clean up
      await db.delete(attendances).where(eq(attendances.eventId, eventId));
      await db.delete(eventRegistrations).where(eq(eventRegistrations.eventId, eventId));
      await db.delete(events).where(eq(events.id, eventId));
      await db.delete(members).where(eq(members.id, memberId));
    });
  }
);
