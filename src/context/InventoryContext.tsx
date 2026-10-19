import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  FiscalYear,
  Facility,
  Scope1Asset,
  Scope2Source,
  OperationalControl,
  KyotoStatus,
  Scope3Status,
} from '@/lib/inventory-types';
import { BLANK_OP_CONTROL } from '@/lib/inventory-data';
import { useClientContext } from '@/lib/client-context';
import { useFiscalYear, useEntity } from '@/lib/entity';
import { authFetch } from '@/lib/auth';
import { toast } from 'sonner';

// Module-level cache keyed by entity code — survives re-mounts within the same
// session but is invalidated when the entity changes, preventing stale cross-entity data.
const _cacheByEntity: Record<string, { scope1: Scope1Asset[]; scope2: Scope2Source[]; opControl: OperationalControl }> = {};
// Facilities are entity-scoped — keyed by entity code to avoid stale cross-entity data.
const _facilitiesByEntity: Record<string, Facility[]> = {};

interface SaveStatus {
  scope1: 'idle' | 'saving' | 'saved' | 'error';
  scope2: 'idle' | 'saving' | 'saved' | 'error';
  opcontrol: 'idle' | 'saving' | 'saved' | 'error';
}

interface InventoryContextType {
  isLoading: boolean;
  facilities: Facility[];
  fiscalYear: FiscalYear;
  setFiscalYear: (fy: FiscalYear) => void;
  scope1Assets: Scope1Asset[];
  addScope1Asset: (asset: Omit<Scope1Asset, 'id'>) => void;
  updateScope1Asset: (id: string, updates: Partial<Scope1Asset>) => void;
  deleteScope1Asset: (id: string) => void;
  scope2Sources: Scope2Source[];
  addScope2Source: (source: Omit<Scope2Source, 'id'>) => void;
  updateScope2Source: (id: string, updates: Partial<Scope2Source>) => void;
  deleteScope2Source: (id: string) => void;
  opControl: OperationalControl;
  updateKyotoGas: (gasKey: keyof OperationalControl['kyoto'], status: KyotoStatus) => void;
  updateScope3Category: (categoryNumber: number, status: Scope3Status, rationale: string) => void;
  saveSection: (section: 'scope1' | 'scope2' | 'opcontrol') => Promise<void>;
  saveStatus: SaveStatus;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const clientCtx = useClientContext();
  const { entity: activeEntityCode } = useEntity();

  // Fallback: derive single facility from the active entity if API returns nothing.
  const activeEntityMeta = clientCtx.entities.find(e => e.code === activeEntityCode)
    ?? clientCtx.entities.find(e => !e.is_consolidated)
    ?? clientCtx.entities[0];
  const entitiesFallback: Facility[] = activeEntityMeta ? [{
    id:            activeEntityMeta.code,
    name:          activeEntityMeta.name,
    address:       activeEntityMeta.legal_address ?? '',
    isHeadOffice:  true,
    controlStatus: 'ownedOperated' as const,
    entity:        activeEntityMeta.code,
  }] : [];

  const [facilities, setFacilities] = useState<Facility[]>(
    (activeEntityCode && _facilitiesByEntity[activeEntityCode]) || entitiesFallback
  );

  // When entity switches, immediately swap to cached data for the new entity (or blank)
  // so the UI never shows the previous entity's assets while the fresh fetch is in flight.
  const prevEntityRef = useRef(activeEntityCode);
  useEffect(() => {
    if (prevEntityRef.current === activeEntityCode) return;
    prevEntityRef.current = activeEntityCode;
    setFacilities(
      (activeEntityCode && _facilitiesByEntity[activeEntityCode]) || entitiesFallback
    );
    const nextCache = activeEntityCode ? (_cacheByEntity[activeEntityCode] ?? null) : null;
    setScope1Assets(nextCache?.scope1 ?? []);
    setScope2Sources(nextCache?.scope2 ?? []);
    setOpControl(nextCache?.opControl ?? BLANK_OP_CONTROL);
    loadedRef.current = nextCache !== null;
    setIsLoading(nextCache === null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntityCode]);

  // Sync fiscal year with the global FY switcher in the nav
  const { fy: fiscalYear, setFY: setFiscalYear } = useFiscalYear();

  // If this entity's cache is ready, skip the loading flash entirely
  const entityCache  = _cacheByEntity[activeEntityCode ?? ''] ?? null;
  const [isLoading, setIsLoading] = useState(entityCache === null);
  const [scope1Assets, setScope1Assets] = useState<Scope1Asset[]>(entityCache?.scope1 ?? []);
  const [scope2Sources, setScope2Sources] = useState<Scope2Source[]>(entityCache?.scope2 ?? []);
  const [opControl, setOpControl] = useState<OperationalControl>(entityCache?.opControl ?? BLANK_OP_CONTROL);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    scope1: 'idle', scope2: 'idle', opcontrol: 'idle',
  });

  // Refs for auto-save — always hold latest state without stale closures
  const scope1Ref    = useRef<Scope1Asset[]>(scope1Assets);
  const scope2Ref    = useRef<Scope2Source[]>(scope2Sources);
  const opControlRef = useRef<OperationalControl>(opControl);
  const loadedRef    = useRef(entityCache !== null); // true if we already have cached data
  const entityRef    = useRef(activeEntityCode);     // always-current entity code for callbacks
  const retries      = useRef<Partial<Record<'scope1' | 'scope2' | 'opcontrol', number>>>({});
  const timers       = useRef<Partial<Record<'scope1' | 'scope2' | 'opcontrol', ReturnType<typeof setTimeout>>>>({});

  useEffect(() => { scope1Ref.current    = scope1Assets;     }, [scope1Assets]);
  useEffect(() => { scope2Ref.current    = scope2Sources;    }, [scope2Sources]);
  useEffect(() => { opControlRef.current = opControl;        }, [opControl]);
  useEffect(() => { entityRef.current    = activeEntityCode; }, [activeEntityCode]);

  // Fetch facilities from ghg/facilities.php and merge with uncovered entities
  useEffect(() => {
    let cancelled = false;
    const qs = activeEntityCode ? `?entity=${encodeURIComponent(activeEntityCode)}` : '';
    authFetch(`ghg/facilities.php${qs}`)
      .then((rows: Array<{ id: number; name: string; entity: string; location: string; status?: string; is_hq?: number | boolean }>) => {
        if (cancelled) return;
        if (!Array.isArray(rows)) return;
        const active = rows.filter(r => (r.status ?? 'active') === 'active');
        const anyHq = active.some(r => !!r.is_hq);
        const mapped: Facility[] = active.map((r, idx) => ({
          id:            String(r.id),
          name:          r.name,
          address:       r.location ?? '',
          isHeadOffice:  anyHq ? !!r.is_hq : idx === 0,
          controlStatus: 'ownedOperated' as const,
          entity:        r.entity,
        }));
        // If the active entity has no facility rows yet, show it as a placeholder
        const coveredCodes = new Set(active.map(r => r.entity));
        const extras: Facility[] = activeEntityCode && !coveredCodes.has(activeEntityCode) && activeEntityMeta
          ? [{
              id:            activeEntityMeta.code,
              name:          activeEntityMeta.name,
              address:       activeEntityMeta.legal_address ?? '',
              isHeadOffice:  false,
              controlStatus: 'ownedOperated' as const,
              entity:        activeEntityMeta.code,
            }]
          : [];
        const combined = [...mapped, ...extras];
        if (combined.length === 0) return; // keep entity fallback
        if (activeEntityCode) _facilitiesByEntity[activeEntityCode] = combined;
        setFacilities(combined);
      })
      .catch(() => { /* keep entity fallback */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientCtx.entities, activeEntityCode]);

  // Fetch from server — pass entity so the backend filters by the selected entity
  // (scoped users are already locked server-side; non-scoped get entity-filtered list).
  // Re-fetch whenever the active entity changes so switching entity refreshes the list.
  useEffect(() => {
    let cancelled = false;
    const entityParam = activeEntityCode ? `?entity=${encodeURIComponent(activeEntityCode)}` : '';
    authFetch(`inventory-boundary.php${entityParam}`)
      .then((data: { scope1: Scope1Asset[]; scope2: Scope2Source[]; opControl: OperationalControl | null }) => {
        if (cancelled) return;
        const fresh = {
          scope1:    data.scope1    ?? [],
          scope2:    data.scope2    ?? [],
          opControl: data.opControl ?? BLANK_OP_CONTROL,
        };
        if (activeEntityCode) _cacheByEntity[activeEntityCode] = fresh;
        setScope1Assets(fresh.scope1);
        setScope2Sources(fresh.scope2);
        setOpControl(fresh.opControl);
        loadedRef.current = true;
      })
      .catch((err) => {
        if (!cancelled) console.error('inventory-boundary load error:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  // Re-fetch whenever the active entity changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntityCode]);

  // ── Auto-save helper ───────────────────────────────────────────────────────
  const scheduleAutoSave = useCallback((section: 'scope1' | 'scope2' | 'opcontrol') => {
    if (!loadedRef.current) return;
    if (timers.current[section]) clearTimeout(timers.current[section]);
    retries.current[section] = 0;
    setSaveStatus((s) => ({ ...s, [section]: 'idle' }));
    const runSave = async () => {
      setSaveStatus((s) => ({ ...s, [section]: 'saving' }));
      const data =
        section === 'scope1'    ? scope1Ref.current :
        section === 'scope2'    ? scope2Ref.current :
        opControlRef.current;
      try {
        await authFetch('inventory-boundary.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, data, entity: entityRef.current }),
        });
        const ec = entityRef.current ?? '';
        if (!_cacheByEntity[ec]) {
          _cacheByEntity[ec] = { scope1: [], scope2: [], opControl: BLANK_OP_CONTROL };
        }
        if (section === 'scope1')    _cacheByEntity[ec].scope1    = scope1Ref.current;
        if (section === 'scope2')    _cacheByEntity[ec].scope2    = scope2Ref.current;
        if (section === 'opcontrol') _cacheByEntity[ec].opControl = opControlRef.current;
        setSaveStatus((s) => ({ ...s, [section]: 'saved' }));
      } catch (err) {
        const attempt = (retries.current[section] ?? 0) + 1;
        retries.current[section] = attempt;
        setSaveStatus((s) => ({ ...s, [section]: 'error' }));
        if (attempt < 3) {
          timers.current[section] = setTimeout(() => runSave(), 4000 * attempt);
        } else {
          toast.error(`Could not save your changes: ${err instanceof Error ? err.message : 'server error'}. Please contact support if this continues.`);
        }
      }
    };
    timers.current[section] = setTimeout(() => runSave(), 1800);
  }, []);

  // ── Scope 1 mutations ──────────────────────────────────────────────────────

  const addScope1Asset = (assetData: Omit<Scope1Asset, 'id'>) => {
    const newAsset: Scope1Asset = { ...assetData, id: `s1-${Date.now()}` };
    setScope1Assets((prev) => [newAsset, ...prev]);
    scheduleAutoSave('scope1');
  };

  const updateScope1Asset = (id: string, updates: Partial<Scope1Asset>) => {
    setScope1Assets((prev) =>
      prev.map((asset) => (asset.id === id ? { ...asset, ...updates } : asset))
    );
    scheduleAutoSave('scope1');
  };

  const deleteScope1Asset = (id: string) => {
    setScope1Assets((prev) => prev.filter((a) => a.id !== id));
    scheduleAutoSave('scope1');
  };

  // ── Scope 2 mutations ──────────────────────────────────────────────────────

  const addScope2Source = (sourceData: Omit<Scope2Source, 'id'>) => {
    const newSource: Scope2Source = { ...sourceData, id: `s2-${Date.now()}` };
    setScope2Sources((prev) => [newSource, ...prev]);
    scheduleAutoSave('scope2');
  };

  const updateScope2Source = (id: string, updates: Partial<Scope2Source>) => {
    setScope2Sources((prev) =>
      prev.map((source) => (source.id === id ? { ...source, ...updates } : source))
    );
    scheduleAutoSave('scope2');
  };

  const deleteScope2Source = (id: string) => {
    setScope2Sources((prev) => prev.filter((s) => s.id !== id));
    scheduleAutoSave('scope2');
  };

  // ── Op control mutations ───────────────────────────────────────────────────

  const updateKyotoGas = (gasKey: keyof OperationalControl['kyoto'], status: KyotoStatus) => {
    setOpControl((prev) => ({ ...prev, kyoto: { ...prev.kyoto, [gasKey]: status } }));
    scheduleAutoSave('opcontrol');
  };

  const updateScope3Category = (categoryNumber: number, status: Scope3Status, rationale: string) => {
    setOpControl((prev) => ({
      ...prev,
      scope3: prev.scope3.map((cat) =>
        cat.categoryNumber === categoryNumber
          ? { ...cat, status, rationale, manuallyEdited: true }
          : cat
      ),
    }));
    scheduleAutoSave('opcontrol');
  };

  // ── Manual save (still available for immediate flush) ──────────────────────

  const saveSection = useCallback(async (section: 'scope1' | 'scope2' | 'opcontrol') => {
    if (timers.current[section]) { clearTimeout(timers.current[section]); delete timers.current[section]; }
    setSaveStatus((s) => ({ ...s, [section]: 'saving' }));
    const data =
      section === 'scope1'    ? scope1Ref.current :
      section === 'scope2'    ? scope2Ref.current :
      opControlRef.current;
    try {
      await authFetch('inventory-boundary.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, data, entity: entityRef.current }),
      });
      const ec = entityRef.current ?? '';
      if (ec) {
        if (!_cacheByEntity[ec]) _cacheByEntity[ec] = { scope1: [], scope2: [], opControl: BLANK_OP_CONTROL };
        if (section === 'scope1')    _cacheByEntity[ec].scope1    = scope1Ref.current;
        if (section === 'scope2')    _cacheByEntity[ec].scope2    = scope2Ref.current;
        if (section === 'opcontrol') _cacheByEntity[ec].opControl = opControlRef.current;
      }
      setSaveStatus((s) => ({ ...s, [section]: 'saved' }));
    } catch (err) {
      console.error('inventory-boundary save error:', err);
      setSaveStatus((s) => ({ ...s, [section]: 'error' }));
    }
  }, []);

  return (
    <InventoryContext.Provider
      value={{
        isLoading,
        facilities,
        fiscalYear,
        setFiscalYear,
        scope1Assets,
        addScope1Asset,
        updateScope1Asset,
        deleteScope1Asset,
        scope2Sources,
        addScope2Source,
        updateScope2Source,
        deleteScope2Source,
        opControl,
        updateKyotoGas,
        updateScope3Category,
        saveSection,
        saveStatus,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
