// Client-side mirror of the database rules (RLS is the real gate).
export type Role = "student" | "faculty" | "admin";
export type Me = { userId: string; roles: Role[] };

export const isAdmin = (me: Me) => me.roles.includes("admin");
export const isStaff = (me: Me) => me.roles.includes("faculty") || isAdmin(me);

/** Owner or admin may edit/delete content (messages, channels, resources, events, announcements). */
export const canManage = (me: Me, ownerId: string | null | undefined) =>
  !!me.userId && (ownerId === me.userId || isAdmin(me));

/** Only the author edits a chat message's text; admins can only delete it. */
export const canEditMessage = (me: Me, authorId: string) => !!me.userId && authorId === me.userId;

export const canPostAnnouncement = (me: Me) => isStaff(me);
export const canPublishEvent = (me: Me) => isStaff(me);
