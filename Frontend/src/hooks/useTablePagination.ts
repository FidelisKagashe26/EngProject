import { useEffect, useMemo, useState } from "react";

export const useTablePagination = <T,>(
  rows: T[],
  initialPageSize = 5,
) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  const paginatedRows = useMemo(
    () => rows.slice(startIndex, endIndex),
    [endIndex, rows, startIndex],
  );

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  const setPageSize = (nextPageSize: number) => {
    const safePageSize = Number.isFinite(nextPageSize) && nextPageSize > 0
      ? Math.floor(nextPageSize)
      : initialPageSize;
    setPageSizeState(safePageSize);
    setPage(1);
  };

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    totalPages,
    startIndex,
    endIndex,
    paginatedRows,
  };
};
