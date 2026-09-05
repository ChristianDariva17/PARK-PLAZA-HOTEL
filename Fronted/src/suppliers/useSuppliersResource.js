import { useState, useEffect, useCallback } from 'react';
import { suppliersClient } from './suppliersClient';

export function useSuppliersResource() {
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 20,
    q: '',
    status: 'active'
  });

  const loadSuppliers = useCallback(async (currentFilters, signal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await suppliersClient.getSuppliers(currentFilters, signal);
      setSuppliers(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error loading suppliers');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSuppliers(filters, controller.signal);
    return () => controller.abort();
  }, [filters, loadSuppliers]);

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: newFilters.page || 1 }));
  };

  const refresh = () => loadSuppliers(filters);

  return {
    suppliers,
    total,
    loading,
    error,
    filters,
    updateFilters,
    refresh
  };
}
