import { describe, expect, it } from "vitest";
import {
  calculateOffset,
  calculatePaginationMeta,
  escapeLikeString,
} from "../../src/common/pagination.js";
import { createErrorResponse, createSuccessResponse } from "../../src/common/response.js";

describe("Response formatting and Pagination helpers", () => {
  it("should create success response without meta", () => {
    const res = createSuccessResponse({ id: 1, name: "Test" });
    expect(res).toEqual({ data: { id: 1, name: "Test" } });
  });

  it("should create success response with pagination meta", () => {
    const meta = calculatePaginationMeta(100, 2, 20);
    const res = createSuccessResponse([{ id: 1 }], meta);
    expect(res.data).toEqual([{ id: 1 }]);
    expect(res.meta).toEqual({
      page: 2,
      limit: 20,
      total: 100,
      totalPages: 5,
    });
  });

  it("should calculate correct offset", () => {
    expect(calculateOffset(1, 20)).toBe(0);
    expect(calculateOffset(2, 20)).toBe(20);
    expect(calculateOffset(3, 10)).toBe(20);
  });

  it("should escape SQL ILIKE wildcard characters properly", () => {
    expect(escapeLikeString("100% discount_now")).toBe("100\\% discount\\_now");
    expect(escapeLikeString("C:\\path\\file")).toBe("C:\\\\path\\\\file");
  });

  it("should create error response formatted according to api.md", () => {
    const err = createErrorResponse("NOT_FOUND", "Data tidak ditemukan.", "req-123");
    expect(err).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Data tidak ditemukan.",
        details: null,
        requestId: "req-123",
      },
    });
  });
});
