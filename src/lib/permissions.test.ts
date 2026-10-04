import { describe, it, expect } from "vitest";
import { canManage, canEditMessage, canPostAnnouncement, canPublishEvent, type Me } from "./permissions";

const student: Me = { userId: "s", roles: ["student"] };
const faculty: Me = { userId: "f", roles: ["faculty"] };
const admin: Me = { userId: "a", roles: ["admin"] };

describe("permissions", () => {
  it("students cannot post announcements", () => expect(canPostAnnouncement(student)).toBe(false));
  it("faculty can post announcements", () => expect(canPostAnnouncement(faculty)).toBe(true));
  it("admins can post announcements", () => expect(canPostAnnouncement(admin)).toBe(true));
  it("students cannot publish campus events", () => expect(canPublishEvent(student)).toBe(false));
  it("owner can manage own content", () => expect(canManage(student, "s")).toBe(true));
  it("users cannot manage others' content", () => expect(canManage(student, "f")).toBe(false));
  it("admins can manage anyone's content", () => expect(canManage(admin, "s")).toBe(true));
  it("admins cannot edit someone else's message text", () => expect(canEditMessage(admin, "s")).toBe(false));
  it("authors can edit their own message", () => expect(canEditMessage(student, "s")).toBe(true));
});
