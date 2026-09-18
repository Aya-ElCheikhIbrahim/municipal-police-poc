import { useEffect, useState } from 'react';
import { useActiveOfficers } from '../officers/useOfficers';
import { useLeafletMap } from './useLeafletMap';
import { useOfficerMarkers } from './useOfficerMarkers';
import { useOfficerTrail } from './useOfficerTrail';
import type { ActiveOfficer, OfficerStatus, OfficerTrail } from '../officers/types';
import {
  formatDuration,
  formatDistance,
  statusLabel,
  pingToCoords,
  displayOfficerStatus,
} from '../officers/types';

/** A request to zoom in on an officer, e.g. from "Locate on Map" on a panic banner. */
export interface MapFocus {
  officerId: number;
  latitude: number;
  longitude: number;
  /** Changes on every click, so asking for the same officer again zooms again. */
  requestedAt: number;
}

const FOCUS_ZOOM = 17;

export function LiveMapPage({ focus = null }: { focus?: MapFocus | null }) {
  const { officers, isLoading, error, secondsSinceUpdate } = useActiveOfficers();
  const [selectedOfficerId, setSelectedOfficerId] = useState<number | null>(focus?.officerId ?? null);
  const [showList, setShowList] = useState(true);

  // A new focus selects that officer, so their details and path show on the right.
  const [handledFocus, setHandledFocus] = useState<MapFocus | null>(focus);
  if (focus !== handledFocus) {
    setHandledFocus(focus);
    if (focus) setSelectedOfficerId(focus.officerId);
  }

  const { containerRef, mapRef } = useLeafletMap();

  useOfficerMarkers({
    mapRef,
    officers,
    selectedOfficerId,
    onSelect: setSelectedOfficerId,
  });

  const { trail, isLoading: isTrailLoading, zoomToTrail } = useOfficerTrail({
    mapRef,
    officerId: selectedOfficerId,
  });

  // Zoom in on the focused spot. Declared after useOfficerMarkers so it runs after
  // its pan-to-selected effect and is not cut short by it.
  useEffect(() => {
    if (!focus) return;
    mapRef.current?.flyTo([focus.latitude, focus.longitude], FOCUS_ZOOM);
  }, [focus, mapRef]);

  const selected = officers.find((o) => o.officer.id === selectedOfficerId) ?? null;

  // Officers in panic go to the top of the list; everyone else keeps the backend order.
  const listedOfficers = [...officers].sort(
    (a, b) =>
      Number(displayOfficerStatus(b) === 'panic') - Number(displayOfficerStatus(a) === 'panic'),
  );

  return (
    <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_2fr_1fr] lg:grid-rows-[minmax(0,1fr)] w-full min-h-0 overflow-y-auto lg:overflow-hidden">
            <aside className={`bg-white border-r border-slate-200 flex-col z-10 shadow-xs overflow-hidden lg:flex ${showList ? 'flex' : 'hidden'} max-h-64 lg:max-h-none lg:min-h-0`}>
        <div className="p-4 lg:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <span className="font-bold text-lg lg:text-xl text-slate-700">On duty</span>
          <span className="text-sm lg:text-base text-slate-400 font-medium">
            {isLoading ? '…' : `${officers.length} officers`}
          </span>
        </div>

        {error && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-800">
            Positions may be out of date. Last update {secondsSinceUpdate}s ago.
          </div>
        )}

        <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3].map((row) => (
                <div key={row} className="animate-pulse space-y-1.5">
                  <div className="h-2.5 bg-slate-200 rounded-full w-3/4"></div>
                  <div className="h-2.5 bg-slate-200 rounded-full w-1/2"></div>
                </div>
              ))}
            </div>
          ) : officers.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-semibold text-slate-700 mb-1">
                No officers on duty
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Officers appear here once they start a shift from the mobile app.
              </p>
            </div>
          ) : (
            listedOfficers.map((entry) => (
              <OfficerRow
                key={entry.officer.id}
                entry={entry}
                isSelected={entry.officer.id === selectedOfficerId}
                onSelect={() => {
                  setSelectedOfficerId(entry.officer.id);
                  setShowList(false);
                }}
              />
            ))
          )}
        </div>
      </aside>

      <div className="lg:hidden flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
        <button
          onClick={() => setShowList(!showList)}
          className="text-sm font-semibold text-[#1F3864] cursor-pointer"
        >
          {showList ? 'Hide officer list' : 'Show officer list'}
        </button>
      </div>

      <main className="flex-1 relative min-h-[300px] lg:min-h-0">
        <div ref={containerRef} className="w-full h-full z-0" />
      </main>

      {selected && (
        <aside className="bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col p-4 lg:p-6 overflow-y-auto z-10 shadow-xs max-h-80 lg:max-h-none">
          <OfficerDetail
            entry={selected}
            trail={trail}
            isTrailLoading={isTrailLoading}
            onZoomToTrail={zoomToTrail}
            onClose={() => setSelectedOfficerId(null)}
          />
        </aside>
      )}

      {!selected && (
        <aside className="hidden lg:flex bg-white border-l border-slate-200 flex-col p-6 overflow-y-auto z-10 shadow-xs">
          <p className="text-sm lg:text-base text-slate-400 text-center mt-8">
            Select an officer to see their shift details.
          </p>
        </aside>
      )}
    </div>
  );
}

function OfficerRow({
  entry,
  isSelected,
  onSelect,
}: {
  entry: ActiveOfficer;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const hasPosition = pingToCoords(entry.latest_ping) !== null;

  return (
    <div
      onClick={onSelect}
      className={`p-4 lg:p-5 transition-colors cursor-pointer ${
        isSelected ? 'bg-slate-100 border-l-4 border-[#1F3864]' : 'hover:bg-[#f8fafc]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-base lg:text-lg text-slate-900 truncate">
          {entry.officer.full_name}
        </span>
        <StatusBadge status={displayOfficerStatus(entry)} />
      </div>
      <div className="text-sm text-slate-400 mt-1">
        Badge {entry.officer.badge_number} ·{' '}
        {formatDuration(entry.shift_duration_seconds)}
      </div>
      {!hasPosition && (
        <div className="text-xs text-amber-600 mt-1">No location yet</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: OfficerStatus }) {
  const styles: Record<OfficerStatus, string> = {
    panic: 'bg-rose-600 text-white animate-pulse',
    on_mission: 'bg-blue-50 text-[#2E5496]',
    available: 'bg-[#2E7D32]/10 text-[#2E7D32]',
  };

  return (
    <span
      className={`text-xs lg:text-sm font-semibold px-2.5 lg:px-3 py-1 rounded-full shrink-0 ${styles[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function OfficerDetail({
  entry,
  trail,
  isTrailLoading,
  onZoomToTrail,
  onClose,
}: {
  entry: ActiveOfficer;
  trail: OfficerTrail | null;
  isTrailLoading: boolean;
  onZoomToTrail: () => void;
  onClose: () => void;
}) {
  const ping = entry.latest_ping;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-start justify-between pb-3 lg:pb-4 border-b border-slate-100 gap-2">
        <h3 className="font-bold text-slate-900 text-xl lg:text-2xl">{entry.officer.full_name}</h3>
        <button onClick={onClose} className="lg:hidden text-slate-400 text-sm cursor-pointer">
          Close
        </button>
        <span className="hidden lg:inline text-base text-slate-400 font-medium shrink-0">
          Badge {entry.officer.badge_number}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          value={formatDuration(entry.shift_duration_seconds)}
          label="On duty"
        />
        <Stat
          value={formatDistance(entry.distance_covered_m)}
          label="Covered today"
        />
      </div>

      {ping && (
        <div className="text-sm lg:text-base text-slate-500 space-y-2 pt-3 lg:pt-4 border-t border-slate-100">
          <div>
            Last fix{' '}
            <span className="font-mono text-slate-700">
              {new Date(ping.recorded_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          {ping.battery_level !== null && <div>Battery {ping.battery_level}%</div>}
          {ping.accuracy_m !== null && <div>Accuracy ±{Math.round(ping.accuracy_m)}m</div>}
        </div>
      )}

      <div className="pt-3 lg:pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm lg:text-base font-semibold text-slate-700">
            Today&apos;s path
          </span>
          {trail && trail.point_count > 1 && (
            <button
              onClick={onZoomToTrail}
              className="text-xs lg:text-sm font-semibold text-[#2E5496] hover:underline cursor-pointer"
            >
              Zoom to path
            </button>
          )}
        </div>
        {isTrailLoading ? (
          <p className="text-sm text-slate-400">Loading path…</p>
        ) : !trail || trail.point_count === 0 ? (
          <p className="text-sm text-slate-400">No location history for today.</p>
        ) : (
          <p className="text-sm lg:text-base text-slate-500">
            {trail.point_count} points · {formatDistance(trail.distance_covered_m)}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-slate-50 p-4 lg:p-5 rounded-lg border border-slate-100">
      <div className="text-2xl lg:text-3xl font-bold text-slate-900">{value}</div>
      <div className="text-xs lg:text-sm text-slate-400 font-medium mt-1">{label}</div>
    </div>
  );
}