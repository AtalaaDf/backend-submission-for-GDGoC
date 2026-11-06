import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../src/common/errors.js";
import { db } from "../../src/db/client.js";
import { AuthenticatedUser } from "../../src/plugins/auth.js";
import { divisionsRepository } from "../../src/modules/divisions/divisions.repository.js";
import { divisionsService } from "../../src/modules/divisions/divisions.service.js";

describe("Divisions Service unit tests", () => {
  const actor: AuthenticatedUser = {
    id: "actor-superadmin-id",
    email: "superadmin@example.com",
    fullName: "Super Admin",
    role: "superadmin",
  };

  it("should fail creating division if name already exists", async () => {
    vi.spyOn(divisionsRepository, "findByName").mockResolvedValueOnce({
      id: "div-1",
      name: "Web Development",
      type: "technical",
      createdAt: new Date(),
    });

    await expect(
      divisionsService.createDivision({
        name: "Web Development",
        type: "technical",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("should fail deleting division if it has members attached (including soft-deleted)", async () => {
    vi.spyOn(divisionsRepository, "findById").mockResolvedValueOnce({
      id: "div-2",
      name: "Mobile Development",
      type: "technical",
      createdAt: new Date(),
    });

    vi.spyOn(divisionsRepository, "countMembersByDivisionId").mockResolvedValueOnce(3);

    await expect(divisionsService.deleteDivision("div-2", actor, "req-div-1")).rejects.toThrow(
      ConflictError
    );
  });

  it("should succeed deleting division if it has zero members", async () => {
    vi.spyOn(divisionsRepository, "findById").mockResolvedValueOnce({
      id: "div-3",
      name: "Empty Division",
      type: "non_technical",
      createdAt: new Date(),
    });

    vi.spyOn(divisionsRepository, "countMembersByDivisionId").mockResolvedValueOnce(0);

    const mockTx = {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    };

    vi.spyOn(db, "transaction").mockImplementationOnce(async (cb) => {
      vi.spyOn(divisionsRepository, "delete").mockResolvedValueOnce(true);
      return cb(mockTx as never);
    });

    await expect(
      divisionsService.deleteDivision("div-3", actor, "req-div-2")
    ).resolves.toBeUndefined();
  });

  it("should throw NotFoundError when deleting non-existent division", async () => {
    vi.spyOn(divisionsRepository, "findById").mockResolvedValueOnce(null);

    await expect(
      divisionsService.deleteDivision("non-existent-div", actor, "req-div-3")
    ).rejects.toThrow(NotFoundError);
  });
});
