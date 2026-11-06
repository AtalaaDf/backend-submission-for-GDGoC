import { and, asc, count, desc, eq } from "drizzle-orm";
import { calculateOffset } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { attendances, divisions, members } from "../../db/schema.js";
import { ListAttendancesQuery } from "./attendances.schema.js";

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export const attendancesRepository = {
  async findMany(eventId: string, query: ListAttendancesQuery) {
    const whereClause = eq(attendances.eventId, eventId);

    const totalResult = await db.select({ count: count() }).from(attendances).where(whereClause);

    const total = Number(totalResult[0]?.count ?? 0);
    const offset = calculateOffset(query.page, query.limit);

    const sortColumn = query.sortBy === "memberName" ? members.fullName : attendances.checkedInAt;
    const sortOrder = query.order === "asc" ? asc(sortColumn) : desc(sortColumn);

    const rows = await db
      .select({
        id: attendances.id,
        eventId: attendances.eventId,
        memberId: attendances.memberId,
        checkedInAt: attendances.checkedInAt,
        recordedBy: attendances.recordedBy,
        createdAt: attendances.createdAt,
        memberIdVal: members.id,
        memberFullName: members.fullName,
        divisionId: divisions.id,
        divisionName: divisions.name,
        divisionType: divisions.type,
      })
      .from(attendances)
      .innerJoin(members, eq(attendances.memberId, members.id))
      .innerJoin(divisions, eq(members.divisionId, divisions.id))
      .where(whereClause)
      .orderBy(sortOrder)
      .limit(query.limit)
      .offset(offset);

    const data = rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      memberId: r.memberId,
      checkedInAt: r.checkedInAt,
      recordedBy: r.recordedBy,
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
      .from(attendances)
      .where(and(eq(attendances.eventId, eventId), eq(attendances.memberId, memberId)))
      .limit(1);

    return result[0] ?? null;
  },

  async insertDoNothing(
    data: {
      eventId: string;
      memberId: string;
      recordedBy: string;
      checkedInAt: Date;
    },
    executor: DbExecutor = db
  ) {
    const result = await executor
      .insert(attendances)
      .values(data)
      .onConflictDoNothing({
        target: [attendances.eventId, attendances.memberId],
      })
      .returning();

    return result[0] ?? null;
  },
};
