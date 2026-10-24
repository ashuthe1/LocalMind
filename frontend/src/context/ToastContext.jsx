// src/context/ToastContext.jsx
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

const ToastContext = createContext({ show: () => {}, success: () => {}, error: () => {}, info: () => {} });

export function ToastProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const current = queue[0];

  const show = useCallback((message, severity = 'info', duration = 4000) => {
    if (!message) return;
    setQueue((q) => [...q, { id: Date.now() + Math.random(), message: String(message), severity, duration }]);
  }, []);

  const value = useMemo(
    () => ({
      show,
      success: (m, d) => show(m, 'success', d),
      error: (m, d) => show(m?.message || m, 'error', d ?? 6000),
      info: (m, d) => show(m, 'info', d),
      warning: (m, d) => show(m, 'warning', d),
    }),
    [show]
  );

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setQueue((q) => q.slice(1));
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={current?.id}
        open={Boolean(current)}
        autoHideDuration={current?.duration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {current ? (
          <Alert onClose={handleClose} severity={current.severity} variant="filled" sx={{ width: '100%' }}>
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
