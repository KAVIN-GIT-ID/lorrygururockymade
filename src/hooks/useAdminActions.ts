import { appwrite } from '../lib/appwrite';
import { OrganizationProfile } from '../types';

interface AdminActionsParams {
  organizationProfiles: () => OrganizationProfile[];
  saveOrganizationProfiles: (profiles: OrganizationProfile[]) => Promise<void>;
  showNotification: (msg: string) => void;
  logAction: (action: string, cat: string, ref: string, details: string, orgId?: string) => void;
}

export function useAdminActions({
  organizationProfiles,
  saveOrganizationProfiles,
  showNotification,
  logAction
}: AdminActionsParams) {

  const handleUpdateOrgStatus = async (orgId: string, status: 'Active' | 'Disabled') => {
    try {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const updatedList = organizationProfiles().map(p =>
        p.organizationId === orgId ? { ...p, status } : p
      );
      await saveOrganizationProfiles(updatedList);

      const target = updatedList.find(p => p.organizationId === orgId);
      if (target) {
        await appwrite.saveGlobalConfig(databaseId, appwrite.getOrgDocId(orgId), target);
      }
      showNotification(`Organization ${orgId} status updated to ${status}.`);
      logAction('Edited', 'OrgProfile', orgId, `Status changed to ${status} by SuperAdmin.`);
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to change organization status: ${err.message}`);
    }
  };

  const handleUpdateOrgLimit = async (orgId: string, limit: number) => {
    try {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const updatedList = organizationProfiles().map(p =>
        p.organizationId === orgId ? { ...p, maxTrucksAllowed: limit } : p
      );
      await saveOrganizationProfiles(updatedList);

      const target = updatedList.find(p => p.organizationId === orgId);
      if (target) {
        await appwrite.saveGlobalConfig(databaseId, appwrite.getOrgDocId(orgId), target);
      }
      showNotification(`Organization ${orgId} limit updated to ${limit} trucks.`);
      logAction('Edited', 'OrgProfile', orgId, `Max truck limit set to ${limit} by SuperAdmin.`);
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to change organization limit: ${err.message}`);
    }
  };

  const handleApproveTruckRequest = async (
    orgId: string,
    requestId: string,
    truckNo: string,
    duration: '1M' | '3M' | '6M' | '1Y' = '1M'
  ) => {
    try {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const profiles = organizationProfiles();
      const orgProfile = profiles.find(p => p.organizationId === orgId) as any;
      if (!orgProfile) return;

      const requests = orgProfile.truckRequests || [];
      const updatedRequests = requests.map(r =>
        r.id === requestId ? { ...r, status: 'Approved' as const } : r
      );

      const monthsMap = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + monthsMap[duration]);

      const activeList = orgProfile.approvedTrucks || [];
      const newApproved = {
        truckNo,
        duration,
        approvedAt: new Date().toISOString(),
        expiresAt: expiry.toISOString()
      };
      const updatedApproved = [...activeList.filter(t => t.truckNo !== truckNo), newApproved];

      const updatedProfile = {
        ...orgProfile,
        truckRequests: updatedRequests,
        approvedTrucks: updatedApproved
      };

      const nextProfiles = organizationProfiles().map(p =>
        p.organizationId === orgId ? updatedProfile : p
      );
      await saveOrganizationProfiles(nextProfiles);

      await appwrite.saveGlobalConfig(databaseId, appwrite.getOrgDocId(orgId), updatedProfile);
      showNotification(`Request approved for truck ${truckNo}.`);
      logAction('Approved', 'TruckRequest', requestId, `Truck request approved for ${duration}.`);
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to approve request: ${err.message}`);
    }
  };

  const handleRejectTruckRequest = async (orgId: string, requestId: string, fallbackTruckNo?: string) => {
    try {
      const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';
      const orgProfile = organizationProfiles().find(p => p.organizationId === orgId) as any;
      if (!orgProfile) return;

      const requests = orgProfile.truckRequests || [];
      const updatedRequests = requests.map(r =>
        r.id === requestId ? { ...r, status: 'Rejected' as const } : r
      );

      const updatedProfile = {
        ...orgProfile,
        truckRequests: updatedRequests
      };

      const nextProfiles = organizationProfiles().map(p =>
        p.organizationId === orgId ? updatedProfile : p
      );
      await saveOrganizationProfiles(nextProfiles);

      await appwrite.saveGlobalConfig(databaseId, appwrite.getOrgDocId(orgId), updatedProfile);
      showNotification(`Request rejected for request ID ${requestId}.`);
      logAction('Rejected', 'TruckRequest', requestId, `Truck request rejected.`);
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to reject request: ${err.message}`);
    }
  };

  return {
    handleUpdateOrgStatus,
    handleUpdateOrgLimit,
    handleApproveTruckRequest,
    handleRejectTruckRequest
  };
}
