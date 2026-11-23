export interface SafePaginationResult {
  skip: number;
  take: number;
  page: number;
  limit: number;
}

export function getSafePagination(
  rawPage?: unknown,
  rawLimit?: unknown,
  defaultLimit = 20,
  maxLimit = 100,
): SafePaginationResult {
  let page = Number(rawPage);
  if (!Number.isFinite(page) || page < 1) {
    page = 1;
  }

  let limit = Number(rawLimit);
  if (!Number.isFinite(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return {
    skip,
    take: limit,
    page,
    limit,
  };
}
