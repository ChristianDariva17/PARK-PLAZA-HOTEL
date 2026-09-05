import { useState, useEffect, useCallback } from 'react';
import { documentsClient } from './documentsClient.js';
import { evidenceClient } from './evidenceClient.js';
import { auditClient } from './auditClient.js';

export function useDocuments(type = 'contracts', initialFilters = {}) {
  const [data, setData] = useState({ items: [], total: 0, hasNextPage: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const limit = 50;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (type === 'contracts') {
        res = await documentsClient.listContracts(page, limit, filters.status, filters.reference);
      } else if (type === 'evidences') {
        res = await evidenceClient.listEvidences(page, limit, filters);
      } else if (type === 'audit') {
        res = await auditClient.listAuditEvents(page, limit, filters);
      } else {
        throw new Error('Tipo de documento no soportado');
      }
      setData({ items: res.data || [], total: res.total || 0, hasNextPage: Boolean(res.hasNextPage) });
    } catch (err) {
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [type, page, limit, filters]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const refresh = () => {
    setPage(1);
    fetchItems();
  };

  return { data, loading, error, filters, setFilters, page, setPage, refresh };
}
