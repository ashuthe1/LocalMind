// src/components/ConnectionBanner.jsx
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@mui/material';

export default function ConnectionBanner({ online, checking, retryIn, onRetry }) {
  if (online) return null;
  return (
    <div className="connection-banner" role="alert">
      {checking ? <RefreshCw size={16} className="spin" /> : <WifiOff size={16} />}
      <span>
        Can&apos;t reach the LocalMind server
        {checking ? ' — checking…' : retryIn > 0 ? ` — retrying in ${retryIn}s` : ' — retrying…'}
      </span>
      <Button size="small" variant="outlined" color="inherit" onClick={onRetry} disabled={checking} sx={{ textTransform: 'none' }}>
        Retry now
      </Button>
    </div>
  );
}
