import { useState, useEffect } from 'react';

export interface PanicAlert {
  id: number;
  officer: {
    id: number;
    full_name: string;
    badge_number: string;
  };
  shift: number;
  latitude: string;
  longitude: string;
  accuracy_m: number | null;
  battery_level: number | null;
  triggered_at: string;
}

// ---------------------------------------------------------------------------
// 1. CONNECTION OVERLAY
// ---------------------------------------------------------------------------

interface ConnectionOverlayProps {
  isConnectionLost: boolean;
}

export function ConnectionOverlay({
  isConnectionLost,
}: ConnectionOverlayProps) {
  const [secondsDisconnected, setSecondsDisconnected] = useState<number>(47);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isConnectionLost) {
      interval = setInterval(() => {
        setSecondsDisconnected((prev) => prev + 1);
      }, 1000);
    } else {
      setSecondsDisconnected(47);
    }

    return () => clearInterval(interval);
  }, [isConnectionLost]);

  if (!isConnectionLost) return null;

  return (
    <div className="flex-1 bg-white flex flex-col items-center justify-center p-8 text-center relative w-full">
      <div className="absolute top-4 left-6 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
        CONNECTION LOST
      </div>

      <div className="flex flex-col items-center justify-center max-w-md">
        <div className="w-9 h-9 border-3 border-slate-200 border-t-[#1F3864] rounded-full animate-spin mb-6"></div>

        <h2 className="text-base font-bold text-slate-900 mb-1.5">
          Reconnecting to the server
        </h2>

        <p className="text-xs text-slate-500 leading-relaxed">
          Officer positions may be out of date. Last update{' '}
          {secondsDisconnected} seconds ago.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. PANIC TOP NOTIFICATION BANNER
// ---------------------------------------------------------------------------

interface PanicOverlayProps {
  panics: PanicAlert[];
  onClose: (id: number) => void;
  onLocate: (latitude: string, longitude: string) => void;
}

export function PanicOverlay({
  panics,
  onClose,
  onLocate,
}: PanicOverlayProps) {
  if (panics.length === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
      {panics.map((panic) => (
        <div
          key={panic.id}
          className="min-w-[600px] bg-rose-600 text-white px-6 py-2.5 rounded-xl shadow-2xl flex items-center gap-4 border border-rose-400"
        >
          <div className="flex items-center gap-3 flex-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>

            <div className="flex flex-col">
              <span className="font-extrabold text-xs uppercase tracking-wider">
                🚨 {panic.officer.full_name} — PANIC ALERT
              </span>

              <span className="text-xs text-rose-100">
                Badge {panic.officer.badge_number} ·{' '}
                {new Date(panic.triggered_at).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                onLocate(panic.latitude, panic.longitude)
              }
              className="bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold px-3 py-1 rounded transition shadow-xs cursor-pointer"
            >
              Locate on Map
            </button>

            <button
              onClick={() => onClose(panic.id)}
              className="bg-rose-800 hover:bg-rose-900 text-white text-xs font-semibold px-3 py-1 rounded border border-rose-500 transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}