import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function parsePaginationQuery(query: unknown) {
  return paginationSchema.parse(query ?? {});
}

export function paginateItems<T>(items: T[], input: { page: number; pageSize: number }) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const safePage = Math.min(input.page, totalPages);
  const start = (safePage - 1) * input.pageSize;
  const pagedItems = items.slice(start, start + input.pageSize);

  return {
    items: pagedItems,
    meta: {
      page: safePage,
      pageSize: input.pageSize,
      total,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1
    } satisfies PaginationMeta
  };
}
