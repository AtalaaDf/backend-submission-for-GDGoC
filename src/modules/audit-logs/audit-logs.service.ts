import { calculatePaginationMeta } from "../../common/pagination.js";
import { auditLogsRepository } from "./audit-logs.repository.js";
import { ListAuditLogsQuery } from "./audit-logs.schema.js";

export const auditLogsService = {
  async listAuditLogs(query: ListAuditLogsQuery) {
    const { data, total } = await auditLogsRepository.findMany(query);
    const meta = calculatePaginationMeta(total, query.page, query.limit);
    return { data, meta };
  },
};

