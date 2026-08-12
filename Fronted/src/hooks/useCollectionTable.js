import { useState } from 'react';

const compare = (left, right) => String(left ?? '').localeCompare(String(right ?? ''), 'es', { numeric: true, sensitivity: 'base' });

export function useCollectionTable(records, initialSort, pageSize = 10, resetKey = '') {
  const [sort, setSort] = useState({ key: initialSort, direction: 'asc' });
  const [pagination, setPagination] = useState({ page: 1, resetKey });
  if (!Object.is(pagination.resetKey, resetKey)) setPagination({ page: 1, resetKey });
  const sorted = records.toSorted((left, right) => {
    const result = compare(left[sort.key], right[sort.key]);
    return sort.direction === 'asc' ? result : -result;
  });
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(pagination.page, pageCount);
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const setPage = (page) => setPagination({ page, resetKey });
  const toggleSort = (key) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    setPagination({ page: 1, resetKey });
  };
  return { visible, sort, toggleSort, page: safePage, pageCount, setPage, total: sorted.length };
}
