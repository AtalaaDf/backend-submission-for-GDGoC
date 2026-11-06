import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { usersRepository } from "../../src/modules/users/users.repository.js";
import { auditLogsRepository } from "../../src/modules/audit-logs/audit-logs.repository.js";
import { divisionsRepository } from "../../src/modules/divisions/divisions.repository.js";
import { membersRepository } from "../../src/modules/members/members.repository.js";
import { eventsRepository } from "../../src/modules/events/events.repository.js";
import { registrationsRepository } from "../../src/modules/registrations/registrations.repository.js";
import { attendancesRepository } from "../../src/modules/attendances/attendances.repository.js";

describe("Authorization Matrix & Ownership Security Suite", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const superadminUser = {
    id: "550e8400-e29b-41d4-a716-446655440001",
    email: "superadmin@gdgoc-unsri.org",
    fullName: "Super Admin",
    role: "superadmin" as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const adminUser = {
    id: "550e8400-e29b-41d4-a716-446655440002",
    email: "admin@gdgoc-unsri.org",
    fullName: "Admin",
    role: "admin" as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const po1User = {
    id: "550e8400-e29b-41d4-a716-446655440003",
    email: "po1@gdgoc-unsri.org",
    fullName: "Product Owner 1",
    role: "po" as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const po2User = {
    id: "550e8400-e29b-41d4-a716-446655440004",
    email: "po2@gdgoc-unsri.org",
    fullName: "Product Owner 2",
    role: "po" as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const executiveUser = {
    id: "550e8400-e29b-41d4-a716-446655440005",
    email: "executive@gdgoc-unsri.org",
    fullName: "Executive Leader",
    role: "executive" as const,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createAuthToken(user: { id: string; role: string }) {
    return app.jwt.sign({ sub: user.id, role: user.role });
  }

  function mockAuthUser(user: typeof superadminUser) {
    vi.spyOn(authRepository, "findById").mockResolvedValue(user);
  }

  describe("1. Unauthenticated Requests (401 UNAUTHORIZED)", () => {
    const protectedRoutes: Array<{ method: "GET" | "POST"; url: string }> = [
      { method: "GET", url: "/api/v1/auth/me" },
      { method: "GET", url: "/api/v1/users" },
      { method: "GET", url: "/api/v1/audit-logs" },
      { method: "GET", url: "/api/v1/divisions" },
      { method: "GET", url: "/api/v1/members" },
      { method: "GET", url: "/api/v1/events" },
    ];

    for (const route of protectedRoutes) {
      it(`${route.method} ${route.url} without token should return 401`, async () => {
        const response = await app.inject({
          method: route.method,
          url: route.url,
        });
        expect(response.statusCode).toBe(401);
        expect(response.json().error.code).toBe("UNAUTHORIZED");
      });
    }
  });

  describe("2. Users & Audit Logs Authorization Matrix", () => {
    it("Superadmin can access GET /api/v1/users", async () => {
      mockAuthUser(superadminUser);
      vi.spyOn(usersRepository, "findMany").mockResolvedValueOnce({ data: [], total: 0 });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users",
        headers: { authorization: `Bearer ${createAuthToken(superadminUser)}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it("Admin, PO, and Executive are rejected from GET /api/v1/users with 403", async () => {
      for (const nonSuperadmin of [adminUser, po1User, executiveUser]) {
        mockAuthUser(nonSuperadmin);
        const response = await app.inject({
          method: "GET",
          url: "/api/v1/users",
          headers: { authorization: `Bearer ${createAuthToken(nonSuperadmin)}` },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe("FORBIDDEN");
      }
    });

    it("Superadmin can access GET /api/v1/audit-logs", async () => {
      mockAuthUser(superadminUser);
      vi.spyOn(auditLogsRepository, "findMany").mockResolvedValueOnce({ data: [], total: 0 });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/audit-logs",
        headers: { authorization: `Bearer ${createAuthToken(superadminUser)}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it("Admin, PO, and Executive are rejected from GET /api/v1/audit-logs with 403", async () => {
      for (const nonSuperadmin of [adminUser, po1User, executiveUser]) {
        mockAuthUser(nonSuperadmin);
        const response = await app.inject({
          method: "GET",
          url: "/api/v1/audit-logs",
          headers: { authorization: `Bearer ${createAuthToken(nonSuperadmin)}` },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("3. Divisions & Members Authorization Matrix", () => {
    it("All authenticated roles can read divisions and members", async () => {
      for (const user of [superadminUser, adminUser, po1User, executiveUser]) {
        mockAuthUser(user);
        vi.spyOn(divisionsRepository, "findMany").mockResolvedValueOnce({ data: [], total: 0 });

        const divRes = await app.inject({
          method: "GET",
          url: "/api/v1/divisions",
          headers: { authorization: `Bearer ${createAuthToken(user)}` },
        });
        expect(divRes.statusCode).toBe(200);

        mockAuthUser(user);
        vi.spyOn(membersRepository, "findMany").mockResolvedValueOnce({ data: [], total: 0 });
        const memRes = await app.inject({
          method: "GET",
          url: "/api/v1/members",
          headers: { authorization: `Bearer ${createAuthToken(user)}` },
        });
        expect(memRes.statusCode).toBe(200);
      }
    });

    it("Only Superadmin can mutate divisions; Admin, PO, Executive are rejected with 403", async () => {
      for (const nonSuperadmin of [adminUser, po1User, executiveUser]) {
        mockAuthUser(nonSuperadmin);
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/divisions",
          headers: { authorization: `Bearer ${createAuthToken(nonSuperadmin)}` },
          payload: { name: "New Division", type: "technical" },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe("FORBIDDEN");
      }
    });

    it("Only Superadmin can mutate members; Admin, PO, Executive are rejected with 403", async () => {
      for (const nonSuperadmin of [adminUser, po1User, executiveUser]) {
        mockAuthUser(nonSuperadmin);
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/members",
          headers: { authorization: `Bearer ${createAuthToken(nonSuperadmin)}` },
          payload: {
            fullName: "John Doe",
            divisionId: "550e8400-e29b-41d4-a716-446655440010",
          },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("4. Events & PO Ownership Authorization Matrix", () => {
    const eventOwnedByPo1 = {
      id: "550e8400-e29b-41d4-a716-446655440099",
      name: "Cloud Workshop",
      description: null,
      type: "offline" as const,
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: po1User.id,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("Superadmin and PO can create events; Admin and Executive get 403", async () => {
      for (const nonEventCreator of [adminUser, executiveUser]) {
        mockAuthUser(nonEventCreator);
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/events",
          headers: { authorization: `Bearer ${createAuthToken(nonEventCreator)}` },
          payload: {
            name: "Forbidden Workshop",
            type: "online",
            startAt: "2026-12-01T10:00:00Z",
            endAt: "2026-12-01T12:00:00Z",
            quota: 50,
          },
        });
        expect(response.statusCode).toBe(403);
      }
    });

    it("Superadmin can update any event", async () => {
      mockAuthUser(superadminUser);
      vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(eventOwnedByPo1);
      vi.spyOn(registrationsRepository, "countByEventId").mockResolvedValueOnce(10);
      vi.spyOn(eventsRepository, "update").mockResolvedValueOnce({
        ...eventOwnedByPo1,
        name: "Superadmin Updated Event",
      });
      vi.spyOn(eventsRepository, "findById").mockResolvedValueOnce({
        ...eventOwnedByPo1,
        name: "Superadmin Updated Event",
        registeredCount: 10,
        remainingQuota: 40,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/events/${eventOwnedByPo1.id}`,
        headers: { authorization: `Bearer ${createAuthToken(superadminUser)}` },
        payload: { name: "Superadmin Updated Event" },
      });
      expect(response.statusCode).toBe(200);
    });

    it("PO owner can update their own event", async () => {
      mockAuthUser(po1User);
      vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(eventOwnedByPo1);
      vi.spyOn(registrationsRepository, "countByEventId").mockResolvedValueOnce(10);
      vi.spyOn(eventsRepository, "update").mockResolvedValueOnce({
        ...eventOwnedByPo1,
        name: "PO1 Updated Event",
      });
      vi.spyOn(eventsRepository, "findById").mockResolvedValueOnce({
        ...eventOwnedByPo1,
        name: "PO1 Updated Event",
        registeredCount: 10,
        remainingQuota: 40,
      });

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/events/${eventOwnedByPo1.id}`,
        headers: { authorization: `Bearer ${createAuthToken(po1User)}` },
        payload: { name: "PO1 Updated Event" },
      });
      expect(response.statusCode).toBe(200);
    });

    it("PO non-owner is rejected with 403 when updating another PO event", async () => {
      mockAuthUser(po2User);
      vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(eventOwnedByPo1);

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/events/${eventOwnedByPo1.id}`,
        headers: { authorization: `Bearer ${createAuthToken(po2User)}` },
        payload: { name: "PO2 Intruder Event" },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });
  });

  describe("5. Registrations & Attendances Authorization Matrix", () => {
    const eventOwnedByPo1 = {
      id: "550e8400-e29b-41d4-a716-446655440099",
      name: "Cloud Workshop",
      description: null,
      type: "offline" as const,
      startAt: new Date("2026-12-01T10:00:00Z"),
      endAt: new Date("2026-12-01T12:00:00Z"),
      quota: 50,
      createdBy: po1User.id,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("Executive is rejected with 403 from viewing or mutating registrations", async () => {
      mockAuthUser(executiveUser);
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/events/${eventOwnedByPo1.id}/registrations`,
        headers: { authorization: `Bearer ${createAuthToken(executiveUser)}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it("PO cannot record attendance on any event (even their own) per API role matrix", async () => {
      mockAuthUser(po1User);
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/events/${eventOwnedByPo1.id}/attendances`,
        headers: { authorization: `Bearer ${createAuthToken(po1User)}` },
        payload: { memberId: "550e8400-e29b-41d4-a716-446655440010" },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });

    it("PO non-owner cannot view attendance of another PO event", async () => {
      mockAuthUser(po2User);
      vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(eventOwnedByPo1);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/events/${eventOwnedByPo1.id}/attendances`,
        headers: { authorization: `Bearer ${createAuthToken(po2User)}` },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("FORBIDDEN");
    });

    it("Admin and Superadmin can view attendance of any event", async () => {
      for (const privilegedUser of [superadminUser, adminUser]) {
        mockAuthUser(privilegedUser);
        vi.spyOn(eventsRepository, "findByIdRaw").mockResolvedValueOnce(eventOwnedByPo1);
        vi.spyOn(attendancesRepository, "findMany").mockResolvedValueOnce({
          data: [],
          total: 0,
        });

        const response = await app.inject({
          method: "GET",
          url: `/api/v1/events/${eventOwnedByPo1.id}/attendances`,
          headers: { authorization: `Bearer ${createAuthToken(privilegedUser)}` },
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });
});
