import { createEffect, batch, onMount, onCleanup } from 'solid-js';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';
import { migrateAuditLogs, migrateUserPermissions, migrateTrucks, migrateTrips, migrateTripsIfNecessary, migrateDrivers, migrateOffices, migrateAccounts, migrateExpenses, migrateTyres } from '../lib/migrations';

export function useBackendSync(
  currentUser: () => any,
  currentUserOrgId: () => string,
  currentUserRights: () => any,
  setTrucks: any,
  setTrips: any,
  setDrivers: any,
  setOffices: any,
  setAccounts: any,
  setExpenses: any,
  setTyres: any,
  setAuditLogs: any,
  setSupportTickets: any,
  userRightsList: () => any[],
  setUserRightsList: any,
  organizationProfiles: () => any[],
  setOrganizationProfiles: any
) {
  createEffect(() => {
    const user = currentUser();
    if (!user) return;

    const email = (user.email || '').toLowerCase().trim();
    const match = userRightsList().find(ur => ur.email.toLowerCase().trim() === email);
    if (!match || match.role !== 'SuperAdmin') return;

    const connectedOrgId = currentUserOrgId() || 'org_backend';
    const isSuper = true;
    const userEmail = email;

    const reloadBackendData = async () => {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
        const rawConfigs = await appwrite.listGlobalConfigs(databaseId);
        const userRightsData = { userRightsList: [], organizationProfiles: [] };
        
        for (const doc of rawConfigs) {
          try {
            const parsed = JSON.parse(doc.data);
            const keyVal = doc.$id || doc.key || '';
            if (keyVal.startsWith('usr_')) {
              userRightsData.userRightsList.push(parsed);
            } else if (keyVal.startsWith('prf_')) {
              if (parsed && parsed.organizationId) {
                userRightsData.organizationProfiles.push(parsed);
              }
            }
          } catch (_) {}
        }

        const orgFleetData: Record<string, any> = {};
        const categories = ['trucks', 'drivers', 'offices', 'accounts', 'trips', 'expenses', 'tyres', 'audit_logs', 'support_tickets'];
        
        await Promise.all(categories.map(async (col) => {
          try {
            const docs = await appwrite.listFleetDocuments(databaseId, col, 'org_backend');
            for (const doc of docs) {
              const oId = doc.organizationId || 'org_default';
              if (!orgFleetData[oId]) {
                orgFleetData[oId] = { trucks: [], drivers: [], offices: [], accounts: [], trips: [], expenses: [], tyres: [], auditLogs: [], supportTickets: [] };
              }
              const parsedRecord = appwrite.reconstructRecord(doc);
              const targetKey = col === 'audit_logs' ? 'auditLogs' : col === 'support_tickets' ? 'supportTickets' : col;
              orgFleetData[oId][targetKey].push(parsedRecord);
            }
          } catch (_) {}
        }));

        batch(() => {
          if (userRightsData.userRightsList.length > 0) {
            const rights = migrateUserPermissions(userRightsData.userRightsList);
            setUserRightsList(rights);
            localStorage.setItem('ttt_user_rights', JSON.stringify(rights));
          }

          if (userRightsData.organizationProfiles.length > 0) {
            setOrganizationProfiles(userRightsData.organizationProfiles);
            localStorage.setItem('ttt_organization_profiles', JSON.stringify(userRightsData.organizationProfiles));
          }

          setTrucks((prev: any[]) => {
            let updated = [...prev];
            for (const orgId in orgFleetData) {
              const orgData = orgFleetData[orgId];
              if (orgData.trucks && Array.isArray(orgData.trucks)) {
                updated = [
                  ...updated.filter(t => t.organizationId !== orgId),
                  ...migrateTrucks(orgData.trucks).map(t => ({ ...t, organizationId: orgId }))
                ];
              }
            }
            localStorage.setItem('ttt_trucks', JSON.stringify(updated));
            return updated;
          });

          setTrips((prev: any[]) => {
            let updated = [...prev];
            for (const orgId in orgFleetData) {
              const orgData = orgFleetData[orgId];
              if (orgData.trips && Array.isArray(orgData.trips)) {
                updated = [
                  ...updated.filter(t => t.organizationId !== orgId),
                  ...migrateTrips(migrateTripsIfNecessary(orgData.trips)).map(t => ({ ...t, organizationId: orgId }))
                ];
              }
            }
            localStorage.setItem('ttt_trips', JSON.stringify(updated));
            return updated;
          });

          setDrivers((prev: any[]) => {
            let updated = [...prev];
            for (const orgId in orgFleetData) {
              const orgData = orgFleetData[orgId];
              if (orgData.drivers && Array.isArray(orgData.drivers)) {
                updated = [
                  ...updated.filter(d => d.organizationId !== orgId),
                  ...migrateDrivers(orgData.drivers).map(d => ({ ...d, organizationId: orgId }))
                ];
              }
            }
            localStorage.setItem('ttt_drivers', JSON.stringify(updated));
            return updated;
          });

          setOffices((prev: any[]) => {
            let updated = [...prev];
            for (const orgId in orgFleetData) {
              const orgData = orgFleetData[orgId];
              if (orgData.offices && Array.isArray(orgData.offices)) {
                updated = [
                  ...updated.filter(o => o.organizationId !== orgId),
                  ...migrateOffices(orgData.offices).map(o => ({ ...o, organizationId: orgId }))
                ];
              }
            }
            localStorage.setItem('ttt_offices', JSON.stringify(updated));
            return updated;
          });

          setAccounts((prev: any[]) => {
            let updated = [...prev];
            for (const orgId in orgFleetData) {
              const orgData = orgFleetData[orgId];
              if (orgData.accounts && Array.isArray(orgData.accounts)) {
                updated = [
                  ...updated.filter(a => a.organizationId !== orgId),
                  ...migrateAccounts(orgData.accounts).map(a => ({ ...a, organizationId: orgId }))
                ];
              }
            }
            localStorage.setItem('ttt_accounts', JSON.stringify(updated));
            return updated;
          });

          setExpenses((prev: any[]) => {
            let updated = [...prev];
            for (const orgId in orgFleetData) {
              const orgData = orgFleetData[orgId];
              if (orgData.expenses && Array.isArray(orgData.expenses)) {
                updated = [
                  ...updated.filter(e => e.organizationId !== orgId),
                  ...migrateExpenses(orgData.expenses).map(e => ({ ...e, organizationId: orgId }))
                ];
              }
            }
            localStorage.setItem('ttt_expenses', JSON.stringify(updated));
            return updated;
          });

          setTyres((prev: any[]) => {
            let updated = [...prev];
            for (const orgId in orgFleetData) {
              const orgData = orgFleetData[orgId];
              if (orgData.tyres && Array.isArray(orgData.tyres)) {
                updated = [
                  ...updated.filter(ty => ty.organizationId !== orgId),
                  ...migrateTyres(orgData.tyres).map(ty => ({ ...ty, organizationId: orgId }))
                ];
              }
            }
            localStorage.setItem('ttt_tyres', JSON.stringify(updated));
            return updated;
          });

          setAuditLogs((prev: any[]) => {
            let updated = [...prev];
            for (const orgId in orgFleetData) {
              const orgData = orgFleetData[orgId];
              if (orgData.auditLogs && Array.isArray(orgData.auditLogs)) {
                updated = [
                  ...updated.filter(l => l.organizationId !== orgId),
                  ...migrateAuditLogs(orgData.auditLogs).map(l => ({ ...l, organizationId: orgId }))
                ];
              }
            }
            localStorage.setItem('fleet_audit_logs', JSON.stringify(updated));
            return updated;
          });

          setSupportTickets((prev: any[]) => {
            let updated = [...prev];
            for (const orgId in orgFleetData) {
              const orgData = orgFleetData[orgId];
              if (orgData.supportTickets && Array.isArray(orgData.supportTickets)) {
                updated = [
                  ...updated.filter(t => t.organizationId !== orgId),
                  ...orgData.supportTickets.map(t => ({ ...t, organizationId: orgId }))
                ];
              }
            }
            localStorage.setItem('ttt_support_tickets', JSON.stringify(updated));
            return updated;
          });
        });

      } catch (err) {
        console.warn("Backend live data sync failed:", err);
      }
    };

    reloadBackendData();

    let unsubscribe: any = null;
    let destroyed = false;
    let reconnectTimer: any = null;
    let reconnectDelay = 5000;
    const MAX_DELAY = 60000;

    const teardown = () => {
      if (unsubscribe) {
        try {
          if (typeof unsubscribe === 'function') unsubscribe();
          else unsubscribe.close?.();
        } catch (_) {}
        unsubscribe = null;
      }
    };

    const scheduleReconnect = () => {
      if (destroyed) return;
      reconnectTimer = setTimeout(() => {
        if (!destroyed) setupRealtime();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
    };

    const setupRealtime = async () => {
      if (destroyed) return;
      teardown();
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        const gatewayUrl = `${wsProtocol}//${wsHost}/realtime?orgId=${connectedOrgId}&email=${userEmail}&isSuperAdmin=${isSuper}`;

        const socket = new WebSocket(gatewayUrl);
        unsubscribe = { close: () => socket.close() };

        socket.onopen = () => {
          reconnectDelay = 1000;
        };

        socket.onmessage = (msg) => {
          try {
            const event = JSON.parse(msg.data);
            const payload = event.payload;
            if (!payload) return;

            const rawEvents: string[] = event.events || [];
            const eventStr = rawEvents[0] || '';
            const parts = eventStr.split('.');
            const collection = (parts.length >= 5 && parts[2] === 'collections') ? parts[3] : null;
            const isDelete = rawEvents.some((e: string) => e.endsWith('.delete'));

            const upsert = <T extends { id: string; organizationId?: string }>(prev: T[], rec: T): T[] => {
              const exists = prev.some(x => x.id === rec.id);
              return exists ? prev.map(x => x.id === rec.id ? rec : x) : [...prev, rec];
            };

            switch (collection) {
              case 'trucks': {
                if (isDelete) {
                  setTrucks((prev: any[]) => prev.filter(t => t.id !== payload.$id));
                } else {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) setTrucks((prev: any[]) => upsert(prev, { ...migrateTrucks([rec])[0], organizationId: rec.organizationId }));
                }
                break;
              }
              case 'trips': {
                if (isDelete) {
                  setTrips((prev: any[]) => prev.filter(t => t.id !== payload.$id));
                } else {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) setTrips((prev: any[]) => upsert(prev, { ...migrateTrips(migrateTripsIfNecessary([rec]))[0], organizationId: rec.organizationId }));
                }
                break;
              }
              case 'drivers': {
                if (isDelete) {
                  setDrivers((prev: any[]) => prev.filter(d => d.id !== payload.$id));
                } else {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) setDrivers((prev: any[]) => upsert(prev, { ...migrateDrivers([rec])[0], organizationId: rec.organizationId }));
                }
                break;
              }
              case 'offices': {
                if (isDelete) {
                  setOffices((prev: any[]) => prev.filter(o => o.id !== payload.$id));
                } else {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) setOffices((prev: any[]) => upsert(prev, { ...migrateOffices([rec])[0], organizationId: rec.organizationId }));
                }
                break;
              }
              case 'accounts': {
                if (isDelete) {
                  setAccounts((prev: any[]) => prev.filter(a => a.id !== payload.$id));
                } else {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) setAccounts((prev: any[]) => upsert(prev, { ...migrateAccounts([rec])[0], organizationId: rec.organizationId }));
                }
                break;
              }
              case 'expenses': {
                if (isDelete) {
                  setExpenses((prev: any[]) => prev.filter(e => e.id !== payload.$id));
                } else {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) setExpenses((prev: any[]) => upsert(prev, { ...migrateExpenses([rec])[0], organizationId: rec.organizationId }));
                }
                break;
              }
              case 'tyres': {
                if (isDelete) {
                  setTyres((prev: any[]) => prev.filter(ty => ty.id !== payload.$id));
                } else {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) setTyres((prev: any[]) => upsert(prev, { ...migrateTyres([rec])[0], organizationId: rec.organizationId }));
                }
                break;
              }
              case 'audit_logs': {
                if (isDelete) {
                  setAuditLogs((prev: any[]) => prev.filter(l => l.id !== payload.$id));
                } else {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) setAuditLogs((prev: any[]) => upsert(prev, { ...migrateAuditLogs([rec])[0], organizationId: rec.organizationId }));
                }
                break;
              }
              case 'support_tickets': {
                if (isDelete) {
                  setSupportTickets((prev: any[]) => prev.filter(t => t.id !== payload.$id));
                } else {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) setSupportTickets((prev: any[]) => upsert(prev, { ...rec, organizationId: rec.organizationId }));
                }
                break;
              }
              case 'global_configs': {
                const key: string = payload.key || '';
                if (key.startsWith('prf_')) {
                  const rec = appwrite.reconstructRecord(payload);
                  if (rec) {
                    const prev = organizationProfiles();
                    const next = prev.some(p => p.organizationId === rec.organizationId)
                      ? prev.map(p => p.organizationId === rec.organizationId ? rec : p)
                      : [...prev, rec];
                    setOrganizationProfiles(next);
                    localStorage.setItem('ttt_organization_profiles', JSON.stringify(next));
                  }
                } else {
                  reloadBackendData();
                }
                break;
              }
              default:
                reloadBackendData();
                break;
            }
          } catch (_) {}
        };

        socket.onclose = () => {
          if (!destroyed) scheduleReconnect();
        };

        socket.onerror = () => socket.close();
      } catch (_) {}
    };

    setupRealtime();

    onCleanup(() => {
      destroyed = true;
      teardown();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    });
  });
}
