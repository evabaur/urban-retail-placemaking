// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    uni: text("uni").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").notNull().default("student"),
    course: text("course").notNull(),
    groupId: text("group_id"),
    password: text("password").notNull(),
    mustChange: integer("must_change").notNull().default(1),
    disabled: integer("disabled").notNull().default(0),
    canvasId: integer("canvas_id"),
    email: text("email"),
  },
  (t) => [index("users_course_group").on(t.course, t.groupId)],
);
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expires: integer("expires").notNull(),
  actor: text("actor"),
});
export const attempts = sqliteTable("attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  until: integer("until").notNull(),
});
export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    course: text("course").notNull(),
    owner: text("owner"),
    groupId: text("group_id"),
    parent: text("parent"),
    data: text("data").notNull(),
    updated: text("updated").notNull(),
  },
  (t) => [
    index("records_kind_course").on(t.kind, t.course),
    index("records_kind_owner").on(t.kind, t.owner),
    index("records_parent").on(t.parent),
  ],
);
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  at: text("at").notNull(),
});
