import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  githubUsername: text("github_username"),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  githubOwner: text("github_owner").notNull(),
  githubRepo: text("github_repo").notNull(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  githubWebhookId: text("github_webhook_id"),
  githubWebhookSecret: text("github_webhook_secret"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const changelogs = pgTable("changelogs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  published: boolean("published").notNull().default(false),
  publishedAt: timestamp("published_at", { mode: "date" }),
  dateFrom: timestamp("date_from", { mode: "date" }),
  dateTo: timestamp("date_to", { mode: "date" }),
  // Review workflow: draft → in_review → approved → published
  reviewStatus: text("review_status").notNull().default("draft"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// Team members for a project (Team plan feature)
export const teamMembers = pgTable("team_members", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  // userId is set once the invite is accepted; null for pending invites
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("reviewer"), // 'reviewer' | 'owner'
  inviteToken: text("invite_token"),
  inviteAcceptedAt: timestamp("invite_accepted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// Reviews submitted on changelogs (Team plan feature)
export const changelogReviews = pgTable("changelog_reviews", {
  id: text("id").primaryKey(),
  changelogId: text("changelog_id")
    .notNull()
    .references(() => changelogs.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'changes_requested'
  comment: text("comment"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// Page views for analytics (Team plan feature)
export const pageViews = pgTable("page_views", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  changelogId: text("changelog_id").references(() => changelogs.id, { onDelete: "set null" }),
  viewedAt: timestamp("viewed_at", { mode: "date" }).notNull().defaultNow(),
  referrer: text("referrer"),
  country: text("country"),
});

// Relations
export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  project: one(projects, { fields: [teamMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const changelogReviewsRelations = relations(changelogReviews, ({ one }) => ({
  changelog: one(changelogs, { fields: [changelogReviews.changelogId], references: [changelogs.id] }),
  reviewer: one(users, { fields: [changelogReviews.reviewerId], references: [users.id] }),
}));

export const changelogsRelations = relations(changelogs, ({ many }) => ({
  reviews: many(changelogReviews),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  teamMembers: many(teamMembers),
  changelogs: many(changelogs),
  pageViews: many(pageViews),
}));

export const pageViewsRelations = relations(pageViews, ({ one }) => ({
  project: one(projects, { fields: [pageViews.projectId], references: [projects.id] }),
  changelog: one(changelogs, { fields: [pageViews.changelogId], references: [changelogs.id] }),
}));
