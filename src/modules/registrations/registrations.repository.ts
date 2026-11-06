import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import { calculateOffset, escapeLikeString } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { attendances, divisions, eventRegistrations, members } from "../../db/schema.js";
import { ListRegistrationsQuery } from "./registrations.schema.js";

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export const registrationsRepository = {
  async findMany(eventId: string, query: ListRegistrationsQuery) {
    const conditions = [eq(eventRegistrations.eventId, eventId)];

    if (query.q) {
      const escaped = escapeLikeString(query.q);
      conditions.push(ilike(members.fullName, `%${escaped}%`));
    }

    const whereClause = and(...conditions);

    const totalResult = await db
      .select({ count: count() })
      .from(eventRegistrations)
      .innerJoin(members, eq(eventRegistrations.memberId, members.id))
      .where(whereClause);

    const total = Number(totalResult[0]?.count ?? 0);
    const offset = calculateOffset(query.page, query.limit);

    const sortColumn =
      query.sortBy === "memberName" ? members.fullName : eventRegistrations.createdAt;
    const sortOrder = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

    const rows = await db
      .select({
        id: eventRegistrations.id,
        eventId: eventRegistrations.eventId,
        memberId: eventRegistrations.memberId,
        registeredBy: eventRegistrations.registeredBy,
        createdAt: eventRegistrations.createdAt,
        memberIdVal: members.id,
        memberFullName: members.fullName,
        divisionId: divisions.id,
        divisionName: divisions.name,
        divisionType: divisions.type,
      })
      .from(eventRegistrations)
      .innerJoin(members, eq(eventRegistrations.memberId, members.id))
      .innerJoin(divisions, eq(members.divisionId, divisions.id))
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(query.limit)
      .offset(offset);

    const data = rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      memberId: r.memberId,
      registeredBy: r.registeredBy,
      createdAt: r.createdAt,
      member: {
        id: r.memberIdVal,
        fullName: r.memberFullName,
        division: {
          id: r.divisionId,
          name: r.divisionName,
          type: r.divisionType,
        },
      },
    }));

    return { data, total };
  },

  async findByEventAndMember(eventId: string, memberId: string, executor: DbExecutor = db) {
    const result = await executor
      .select()
      .from(eventRegistrations)
      .where(
        and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.memberId, memberId))
      )
      .limit(1);

    return result[0] ?? null;
  },

  async hasAttendance(
    eventId: string,
    memberId: string,
    executor: DbExecutor = db
  ): Promise<boolean> {
    const result = await executor
      .select({ count: count() })
      .from(attendances)
      .where(and(eq(attendances.eventId, eventId), eq(attendances.memberId, memberId)));

    return Number(result[0]?.count ?? 0) > 0;
  },

  async countByEventId(eventId: string, executor: DbExecutor = db): Promise<number> {
    const result = await executor
      .select({ count: count() })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId));

    return Number(result[0]?.count ?? 0);
  },

  async create(
    data: { eventId: string; memberId: string; registeredBy: string },
    executor: DbExecutor = db
  ) {
    const result = await executor.insert(eventRegistrations).values(data).returning();

    return result[0];
  },

  async delete(eventId: string, memberId: string, executor: DbExecutor = db): Promise<boolean> {
    const result = await executor
      .delete(eventRegistrations)
      .where(
        and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.memberId, memberId))
      )
      .returning({ id: eventRegistrations.id });

    return result.length > 0;
  },
};
