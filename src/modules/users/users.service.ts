import argon2 from "argon2";
import { recordAuditLog } from "../../common/audit.js";
import { ConflictError, InternalServerError, NotFoundError } from "../../common/errors.js";
import { calculatePaginationMeta } from "../../common/pagination.js";
import { db } from "../../db/client.js";
import { AuthenticatedUser } from "../../plugins/auth.js";
import { usersRepository } from "./users.repository.js";
import {
  CreateUserBody,
  ListUsersQuery,
  UpdateUserRoleBody,
  UpdateUserStatusBody,
} from "./users.schema.js";

export const usersService = {
  async listUsers(query: ListUsersQuery) {
    const { data, total } = await usersRepository.findMany(query);
    const meta = calculatePaginationMeta(total, query.page, query.limit);
    return { data, meta };
  },

  async createUser(input: CreateUserBody, actor: AuthenticatedUser, requestId: string) {
    const existing = await usersRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError("EMAIL_ALREADY_EXISTS", "Email sudah terdaftar.");
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    return await db.transaction(async (tx) => {
      const newUser = await usersRepository.create(
        {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          role: input.role,
        },
        tx
      );

      if (!newUser) {
        throw new InternalServerError("Gagal membuat pengguna baru.");
      }

      await recordAuditLog(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "user.created",
          entity: "user",
          entityId: newUser.id,
          before: null,
          after: {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.fullName,
            role: newUser.role,
            isActive: newUser.isActive,
          },
          requestId,
        },
        tx
      );

      return newUser;
    });
  },

  async updateUserRole(
    id: string,
    input: UpdateUserRoleBody,
    actor: AuthenticatedUser,
    requestId: string
  ) {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan.");
    }

    if (user.role === input.role) {
      return user;
    }

    return await db.transaction(async (tx) => {
      if (user.role === "superadmin" && input.role !== "superadmin" && user.isActive) {
        const activeSuperadmins = await usersRepository.countActiveSuperadmins(tx);
        if (activeSuperadmins <= 1) {
          throw new ConflictError(
            "LAST_SUPERADMIN",
            "Tidak dapat menurunkan role superadmin terakhir yang aktif."
          );
        }
      }

      const updatedUser = await usersRepository.update(id, { role: input.role }, tx);
      if (!updatedUser) {
        throw new NotFoundError("Pengguna tidak ditemukan.");
      }

      await recordAuditLog(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "user.role_changed",
          entity: "user",
          entityId: id,
          before: { role: user.role },
          after: { role: input.role },
          requestId,
        },
        tx
      );

      return updatedUser;
    });
  },

  async updateUserStatus(
    id: string,
    input: UpdateUserStatusBody,
    actor: AuthenticatedUser,
    requestId: string
  ) {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError("Pengguna tidak ditemukan.");
    }

    if (user.isActive === input.isActive) {
      return user;
    }

    return await db.transaction(async (tx) => {
      if (user.role === "superadmin" && user.isActive && !input.isActive) {
        const activeSuperadmins = await usersRepository.countActiveSuperadmins(tx);
        if (activeSuperadmins <= 1) {
          throw new ConflictError(
            "LAST_SUPERADMIN",
            "Tidak dapat menonaktifkan superadmin terakhir yang aktif."
          );
        }
      }

      const updatedUser = await usersRepository.update(id, { isActive: input.isActive }, tx);
      if (!updatedUser) {
        throw new NotFoundError("Pengguna tidak ditemukan.");
      }

      await recordAuditLog(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: "user.status_changed",
          entity: "user",
          entityId: id,
          before: { isActive: user.isActive },
          after: { isActive: input.isActive },
          requestId,
        },
        tx
      );

      return updatedUser;
    });
  },
};
