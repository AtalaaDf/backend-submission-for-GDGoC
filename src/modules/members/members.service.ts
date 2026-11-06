import { recordAuditLog } from "../../common/audit.js";
import { clock } from "../../common/clock.js";
import { ConflictError, InternalServerError, NotFoundError } from "../../common/errors.js";
import { calculatePaginationMeta } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { AuthenticatedUser } from "../../plugins/auth.js";
import { divisionsRepository } from "../divisions/divisions.repository.js";
import { membersRepository } from "./members.repository.js";
import { CreateMemberBody, ListMembersQuery, UpdateMemberBody } from "./members.schema.js";

export const membersService = {
  async listMembers(query: ListMembersQuery, actor: AuthenticatedUser) {
    // Only superadmin is allowed to view soft-deleted members
    const allowDeleted = actor.role === "superadmin" && query.includeDeleted === true;

    const { data, total } = await membersRepository.findMany(query, allowDeleted);
    const meta = calculatePaginationMeta(total, query.page, query.limit);

    return { data, meta };
  },

  async getMemberById(id: string, actor: AuthenticatedUser) {
    const member = await membersRepository.findById(id);
    if (!member) {
      throw new NotFoundError("Member tidak ditemukan.");
    }

    // Non-superadmin cannot view soft-deleted members
    if (member.deletedAt !== null && actor.role !== "superadmin") {
      throw new NotFoundError("Member tidak ditemukan.");
    }

    return member;
  },

  async createMember(input: CreateMemberBody) {
    const division = await divisionsRepository.findById(input.divisionId);
    if (!division) {
      throw new NotFoundError("Divisi tidak ditemukan.");
    }

    const member = await membersRepository.create(input);
    if (!member) {
      throw new InternalServerError("Gagal menambahkan member.");
    }

    return {
      ...member,
      division: {
        id: division.id,
        name: division.name,
        type: division.type,
      },
    };
  },

  async updateMember(id: string, input: UpdateMemberBody) {
    const existing = await membersRepository.findById(id);
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundError("Member tidak ditemukan.");
    }

    if (input.divisionId) {
      const division = await divisionsRepository.findById(input.divisionId);
      if (!division) {
        throw new NotFoundError("Divisi tidak ditemukan.");
      }
    }

    const updateData: { fullName?: string; divisionId?: string } = {};
    if (input.fullName !== undefined) {
      updateData.fullName = input.fullName.trim();
    }
    if (input.divisionId !== undefined) {
      updateData.divisionId = input.divisionId;
    }

    const updated = await membersRepository.update(id, updateData);
    if (!updated) {
      throw new NotFoundError("Member tidak ditemukan.");
    }

    const fullMember = await membersRepository.findById(id);
    return fullMember!;
  },

  async deleteMember(id: string, actor: AuthenticatedUser, requestId: string) {
    const member = await membersRepository.findById(id);
    if (!member || member.deletedAt !== null) {
      throw new NotFoundError("Member tidak ditemukan.");
    }

    const now = clock.now();

    await db.transaction(async (tx) => {
      await membersRepository.softDelete(id, tx);

      await recordAuditLog(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "member.deleted",
          entity: "member",
          entityId: id,
          before: { deletedAt: null },
          after: { deletedAt: now.toISOString() },
          requestId,
        },
        tx
      );
    });
  },

  async restoreMember(id: string, actor: AuthenticatedUser, requestId: string) {
    const member = await membersRepository.findById(id);
    if (!member) {
      throw new NotFoundError("Member tidak ditemukan.");
    }

    if (member.deletedAt === null) {
      throw new ConflictError("MEMBER_NOT_DELETED", "Member tidak dalam status terhapus.");
    }

    await db.transaction(async (tx) => {
      await membersRepository.restore(id, tx);

      await recordAuditLog(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "member.restored",
          entity: "member",
          entityId: id,
          before: { deletedAt: member.deletedAt },
          after: { deletedAt: null },
          requestId,
        },
        tx
      );
    });

    const restored = await membersRepository.findById(id);
    return restored!;
  },
};
