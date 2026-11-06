import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["superadmin", "admin", "executive", "po"]);
export const divisionTypeEnum = pgEnum("division_type", ["technical", "non_technical"]);
export const eventTypeEnum = pgEnum("event_type", ["online", "offline"]);

// Users table (jabatan accounts)
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`)]
);

// Divisions table
export const divisions = pgTable("divisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  type: divisionTypeEnum("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Members table
export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    divisionId: uuid("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "restrict" }),
    fullName: text("full_name").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("members_division_id_idx")
      .on(table.divisionId)
      .where(sql`${table.deletedAt} IS NULL`),
    index("members_full_name_idx").on(table.fullName),
  ]
);

// Events table
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    type: eventTypeEnum("type").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    quota: integer("quota").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("events_end_at_after_start_at", sql`${table.endAt} > ${table.startAt}`),
    check("events_quota_positive", sql`${table.quota} > 0`),
    index("events_start_at_idx").on(table.startAt),
    index("events_created_by_idx").on(table.createdBy),
  ]
);

// Event Registrations table
export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    registeredBy: uuid("registered_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("event_registrations_event_member_unique").on(table.eventId, table.memberId),
    index("event_registrations_event_id_idx").on(table.eventId),
  ]
);

// Attendances table
export const attendances = pgTable(
  "attendances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull(),
    memberId: uuid("member_id").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("attendances_event_member_unique").on(table.eventId, table.memberId),
    index("attendances_event_id_idx").on(table.eventId),
    foreignKey({
      columns: [table.eventId, table.memberId],
      foreignColumns: [eventRegistrations.eventId, eventRegistrations.memberId],
      name: "attendances_event_member_fk",
    }).onDelete("restrict"),
  ]
);

// Audit Logs table (append-only)
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: userRoleEnum("actor_role").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    requestId: text("request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_created_at_desc_idx").on(table.createdAt.desc()),
    index("audit_logs_entity_entity_id_idx").on(table.entity, table.entityId),
    index("audit_logs_actor_id_idx").on(table.actorId),
  ]
);

// Inferred Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Division = typeof divisions.$inferSelect;
export type NewDivision = typeof divisions.$inferInsert;

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type NewEventRegistration = typeof eventRegistrations.$inferInsert;

export type Attendance = typeof attendances.$inferSelect;
export type NewAttendance = typeof attendances.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
