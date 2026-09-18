import { useState } from 'react';
import { useMissions } from './useMissions';
import { useActiveOfficers } from '../officers/useOfficers';
import { MissionTable } from './MissionTable';
import { MissionFilters } from './MissionFilters';
import { MissionDetailPage } from './MissionDetailPage';
import { CreateMissionPage } from './CreateMissionPage';
import type { MissionFilters as Filters, CreateMissionRequest } from './types';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; missionId: number }
  | { kind: 'create' };

export function MissionsPage() {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [filters, setFilters] = useState<Filters>({});

  const { missions, isLoading, error, refresh, createMission } = useMissions(filters);

  
  const { officers } = useActiveOfficers(false);

  async function handleCreate(payload: CreateMissionRequest) {
    const created = await createMission(payload);
    setView({ kind: 'detail', missionId: created.id });
  }

  if (view.kind === 'create') {
    return (
      <CreateMissionPage
        officers={officers}
        onSubmit={handleCreate}
        onCancel={() => setView({ kind: 'list' })}
      />
    );
  }

  if (view.kind === 'detail') {
    return (
      <MissionDetailPage
        missionId={view.missionId}
        officers={officers}
        onBack={() => setView({ kind: 'list' })}
        onChanged={refresh}
      />
    );
  }

  return (
    <div className="flex-1 bg-white flex flex-col min-h-0">
      {/* Filters bar stays fixed at the top; only the list below scrolls. */}
      <div className="shrink-0 relative z-10 px-6 pt-6 border-b border-slate-100">
        <MissionFilters
          filters={filters}
          onChange={setFilters}
          officers={officers}
          onCreate={() => setView({ kind: 'create' })}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-6 flex flex-col">
        {error && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <MissionTable
          missions={missions}
          isLoading={isLoading}
          onSelect={(missionId) => setView({ kind: 'detail', missionId })}
          onClearFilters={() => setFilters({})}
          onCreate={() => setView({ kind: 'create' })}
        />
      </div>
    </div>
  );
}