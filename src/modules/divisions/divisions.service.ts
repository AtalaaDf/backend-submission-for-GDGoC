import { recordAuditLog } from "../../common/audit.js";
import { ConflictError, InternalServerError, NotFoundError } from "../../common/errors.js";
import { calculatePaginationMeta } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { AuthenticatedUser } from "../../plugins/auth.js";
import { divisionsRepository } from "./divisions.repository.js";
import { CreateDivisionBody, ListDivisionsQuery, UpdateDivisionBody } from "./divisions.schema.js";

export const divisionsService = {
  async listDivisions(query: ListDivisionsQuery) {
    const { data, total } = await divisionsRepository.findMany(query);
    const meta = calculatePaginationMeta(total, query.page, query.limit);
    return { data, meta };
  },

  async getDivisionById(id: string) {
    const division = await divisionsRepository.findById(id);
    if (!division) {
      throw new NotFoundError("Divisi tidak ditemukan.");
    }
    return division;
  },

  async createDivision(input: CreateDivisionBody) {
    const existing = await divisionsRepository.findByName(input.name);
    if (existing) {
      throw new ConflictError("DIVISION_NAME_EXISTS", "Nama divisi sudah digunakan.");
    }

    const division = await divisionsRepository.create({
      name: input.name.trim(),
      type: input.type,
    });

    if (!division) {
      throw new InternalServerError("Gagal membuat divisi baru.");
    }

    return division;
  },

  async updateDivision(id: string, input: UpdateDivisionBody) {
    const division = await divisionsRepository.findById(id);
    if (!division) {
      throw new NotFoundError("Divisi tidak ditemukan.");
    }

    if (input.name && input.name.trim().toLowerCase() !== division.name.toLowerCase()) {
      const existing = await divisionsRepository.findByName(input.name);
      if (existing && existing.id !== id) {
        throw new ConflictError("DIVISION_NAME_EXISTS", "Nama divisi sudah digunakan.");
      }
    }

    const updateData: { name?: string; type?: "technical" | "non_technical" } = {};
    if (input.name !== undefined) {
      updateData.name = input.name.trim();
    }
    if (input.type !== undefined) {
      updateData.type = input.type;
    }

    const updated = await divisionsRepository.update(id, updateData);

    if (!updated) {
      throw new NotFoundError("Divisi tidak ditemukan.");
    }

    return updated;
  },

  async deleteDivision(id: string, actor: AuthenticatedUser, requestId: string) {
    const division = await divisionsRepository.findById(id);
    if (!division) {
      throw new NotFoundError("Divisi tidak ditemukan.");
    }

    const memberCount = await divisionsRepository.countMembersByDivisionId(id);
    if (memberCount > 0) {
      throw new ConflictError(
        "DIVISION_NOT_EMPTY",
        "Divisi masih memiliki member terkait dan tidak dapat dihapus."
      );
    }

    await db.transaction(async (tx) => {
      await divisionsRepository.delete(id, tx);

      await recordAuditLog(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "division.deleted",
          entity: "division",
          entityId: id,
          before: {
            name: division.name,
            type: division.type,
          },
          after: null,
          requestId,
        },
        tx
      );
    });
  },
};
