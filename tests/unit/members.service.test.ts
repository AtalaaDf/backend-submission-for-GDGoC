import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../src/common/errors.js";
import { db } from "../../src/db/client.js";
import { AuthenticatedUser } from "../../src/plugins/auth.js";
import { divisionsRepository } from "../../src/modules/divisions/divisions.repository.js";
import { membersRepository } from "../../src/modules/members/members.repository.js";
import { membersService } from "../../src/modules/members/members.service.js";

describe("Members Service unit tests", () => {
  const superadmin: AuthenticatedUser = {
    id: "sa-id",
    email: "sa@example.com",
    fullName: "Super Admin",
    role: "superadmin",
  };

  const executive: AuthenticatedUser = {
    id: "exec-id",
    email: "exec@example.com",
    fullName: "Executive",
    role: "executive",
  };

  it("should fail creating member when division does not exist", async () => {
    vi.spyOn(divisionsRepository, "findById").mockResolvedValueOnce(null);

    await expect(
      membersService.createMember({
        fullName: "John Doe",
        divisionId: "non-existent-div",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("should succeed creating member with valid division", async () => {
    vi.spyOn(divisionsRepository, "findById").mockResolvedValueOnce({
      id: "div-1",
      name: "Web Dev",
      type: "technical",
      createdAt: new Date(),
    });

    vi.spyOn(membersRepository, "create").mockResolvedValueOnce({
      id: "m-1",
      fullName: "John Doe",
      divisionId: "div-1",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await membersService.createMember({
      fullName: "John Doe",
      divisionId: "div-1",
    });

    expect(result.id).toBe("m-1");
    expect(result.fullName).toBe("John Doe");
    expect(result.division.name).toBe("Web Dev");
  });

  it("should hide soft-deleted member from non-superadmin in getMemberById", async () => {
    vi.spyOn(membersRepository, "findById").mockResolvedValueOnce({
      id: "m-deleted",
      fullName: "Deleted Member",
      deletedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      division: {
        id: "div-1",
        name: "Web Dev",
        type: "technical",
      },
    });

    await expect(membersService.getMemberById("m-deleted", executive)).rejects.toThrow(
      NotFoundError
    );
  });

  it("should allow superadmin to view soft-deleted member", async () => {
    const deletedDate = new Date();
    vi.spyOn(membersRepository, "findById").mockResolvedValueOnce({
      id: "m-deleted",
      fullName: "Deleted Member",
      deletedAt: deletedDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      division: {
        id: "div-1",
        name: "Web Dev",
        type: "technical",
      },
    });

    const result = await membersService.getMemberById("m-deleted", superadmin);
    expect(result.id).toBe("m-deleted");
    expect(result.deletedAt).toEqual(deletedDate);
  });

  it("should soft delete member and record audit log", async () => {
    vi.spyOn(membersRepository, "findById").mockResolvedValueOnce({
      id: "m-2",
      fullName: "Active Member",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      division: {
        id: "div-1",
        name: "Web Dev",
        type: "technical",
      },
    });

    const mockTx = {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    };

    vi.spyOn(db, "transaction").mockImplementationOnce(async (cb) => {
      vi.spyOn(membersRepository, "softDelete").mockResolvedValueOnce({
        id: "m-2",
        fullName: "Active Member",
        divisionId: "div-1",
        deletedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return cb(mockTx as never);
    });

    await expect(
      membersService.deleteMember("m-2", superadmin, "req-del-m")
    ).resolves.toBeUndefined();
  });

  it("should reject restoring member if member is not deleted", async () => {
    vi.spyOn(membersRepository, "findById").mockResolvedValueOnce({
      id: "m-3",
      fullName: "Active Member",
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      division: {
        id: "div-1",
        name: "Web Dev",
        type: "technical",
      },
    });

    await expect(membersService.restoreMember("m-3", superadmin, "req-rest-m")).rejects.toThrow(
      ConflictError
    );
  });
});
