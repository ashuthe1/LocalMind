// src/components/ConnectionBanner.jsx
import { RefreshCw } from 'lucide-react';

export default function ConnectionBanner({ online, checking, retryIn, onRetry }) {
  if (online) return null;
  return (
    <div className="connection-banner" role="alert">
      {checking ? <RefreshCw size={14} className="spin" /> : <span className="dot" />}
      <span>
        Can&apos;t reach the LocalMind server
        {checking ? ' — checking…' : retryIn > 0 ? ` — retrying in ${retryIn}s` : ' — retrying…'}
      </span>
      <button className="btn text" onClick={onRetry} disabled={checking}>
        Retry now
      </button>
    </div>
  );
}
