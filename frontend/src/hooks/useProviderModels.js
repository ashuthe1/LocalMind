// src/hooks/useProviderModels.js
import { useEffect, useState } from 'react';
import { api } from '../services/api';

/** Fetches the model list of a provider with a fallback to its manual list. */
export function useProviderModels(providerId, providers) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const provider = providers.find((p) => p.id === providerId);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (!providerId) {
      setModels([]);
      return undefined;
    }
    setLoading(true);
    api
      .getProviderModels(providerId, controller.signal)
      .then((list) => {
        if (!cancelled) setModels(Array.isArray(list) && list.length ? list : (provider?.models || []).map((id) => ({ id, name: id })));
      })
      .catch(() => {
        if (!cancelled) setModels((provider?.models || []).map((id) => ({ id, name: id })));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  return { models, loading };
}

