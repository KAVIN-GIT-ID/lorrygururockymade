import { Accessor } from 'solid-js';
import { Truck, AuditLog, TruckRequest, createRecord, mutateRecord } from '../types';
import { appwrite, isAppwriteConfigured } from '../lib/appwrite';

export function useTruckHandlers(
  trucks: Truck[],
  setTrucks: (updater: (prev: Truck[]) => Truck[]) => void,
  orgTrucks: Truck[],
  organizationProfiles: Accessor<any[]>,
  saveOrganizationProfiles: (profiles: any[]) => Promise<void>,
  orgAccounts: any[],
  addExpense: (expense: any) => Promise<void>,
  payments: Accessor<any[]>,
  savePayments: (next: any[]) => void,
  currentUserOrgId: Accessor<string>,
  currentUser: Accessor<any>,
  currentUserRights: Accessor<any>,
  currentUserId: Accessor<string>,
  touchLastModified: () => void,
  logAction: (action: string, category: string, reference: string, details: string, orgId?: string) => void,
  showNotification: (msg: string) => void
) {
  const handleVerifyPhonePePayment = async (txnId: string, truckNo: string) => {
    try {
      showNotification("Verifying PhonePe payment status...");
      const serverUrl = import.meta.env.DEV ? '' : 'https://api.lorryguru.in/truck-backend';

      const tempPayloadStr = sessionStorage.getItem('ttt_temp_payment_payload');
      const tempPayloadObj = tempPayloadStr ? JSON.parse(tempPayloadStr) : null;
      const duration = sessionStorage.getItem('ttt_temp_payment_duration') || '1 Year';
      const existingTruckId = sessionStorage.getItem('ttt_temp_payment_truck_id') || '';

      const queryParams = new URLSearchParams({
        truckNo,
        organizationId: (currentUserRights()?.organizationId) || 'org_default',
        duration,
        customerName: currentUser()?.name || '',
        customerEmail: currentUser()?.email || '',
        customerPhone: currentUser()?.phone || '',
        existingTruckId,
        truckPayload: JSON.stringify(tempPayloadObj)
      });

      const jwt = await appwrite.createSessionJwt();
      const response = await fetch(`${serverUrl}/api/payment/status/${txnId}?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      const data = await response.json();

      if (response.ok && data.success) {
        sessionStorage.removeItem('ttt_temp_payment_payload');
        sessionStorage.removeItem('ttt_temp_payment_duration');
        sessionStorage.removeItem('ttt_temp_payment_truck_id');

        showNotification(`Payment verified! Truck ${truckNo} is now Active.`);

        if (data.expiryDate && tempPayloadObj) {
          const targetId = existingTruckId || ('tr_' + Date.now());
          setTrucks(prev => {
            const next = prev.map(t => t.id === targetId ? {
              ...t,
              ...tempPayloadObj,
              isApproved: true,
              requestStatus: 'Approved' as const,
              status: 'Active' as const,
              registrationExpiryDate: data.expiryDate
            } : t);
            localStorage.setItem('ttt_trucks', JSON.stringify(next));
            return next;
          });
        }
      } else {
        alert(`Payment Verification Failed: ${data.message || 'Transaction was not successful'}`);
      }

    } catch (err: any) {
      console.error('Verify Payment Error:', err);
      alert(`Error verifying payment: ${err.message}`);
    } finally {
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    }
  };

  const handleBackendUpdateTruck = async (targetOrgId: string, updatedTruck: Truck) => {
    const startTime = performance.now();
    console.log(`[Timer] Start updating truck ${updatedTruck.truckNo} at ${new Date().toISOString()}`);

    const oldTruck = trucks.find(t => t.id === updatedTruck.id);
    const mutatedTruck = oldTruck
      ? mutateRecord(oldTruck, updatedTruck, currentUserId())
      : createRecord<Truck>({ ...updatedTruck, organizationId: targetOrgId } as any, currentUserId());

    setTrucks(prev => {
      const next = prev.map(t => t.id === mutatedTruck.id ? mutatedTruck : t);
      localStorage.setItem('ttt_trucks', JSON.stringify(next));
      return next;
    });
    console.log(`[Timer] Local state updated in ${(performance.now() - startTime).toFixed(1)}ms`);

    if (isAppwriteConfigured()) {
      try {
        const databaseId = localStorage.getItem('appwrite_database_id') || 'fleet_db';

        const saveStart = performance.now();
        console.log(`[Timer] Pushing truck document update to Appwrite proxy...`);
        await appwrite.saveFleetDocument(databaseId, 'trucks', mutatedTruck.id, targetOrgId, mutatedTruck);
        console.log(`[Timer] Appwrite proxy save completed in ${(performance.now() - saveStart).toFixed(1)}ms`);

        const auditStart = performance.now();
        const userEmail = currentUser() ? (currentUser().email || currentUser().name || 'SuperAdmin') : 'SuperAdmin';
        const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
        const newAuditLog: AuditLog = {
          id: logId,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          user: userEmail,
          action: 'Edited',
          category: 'Truck',
          reference: updatedTruck.truckNo.toUpperCase(),
          details: `Compliance parameters or status updated by admin. Status: ${updatedTruck.status}`,
          organizationId: targetOrgId
        };
        await appwrite.saveFleetDocument(databaseId, 'audit_logs', logId, targetOrgId, newAuditLog);
        console.log(`[Timer] Audit log saved in ${(performance.now() - auditStart).toFixed(1)}ms`);
      } catch (err: any) {
        console.error("Backend failed to push remote truck updates to database:", err);
        alert(`Error pushing truck updates to organization database: ${err.message}`);
      }
    }

    logAction('Edited', 'Truck', updatedTruck.truckNo, `Super Admin modified remote truck details for Org ${targetOrgId}. Status: ${updatedTruck.status}`, targetOrgId);
    showNotification(`Updated truck ${updatedTruck.truckNo} details.`);
    console.log(`[Timer] Total disable operation took ${(performance.now() - startTime).toFixed(1)}ms`);
  };

  const handleAddTruckRequest = async (truckPayload: Omit<Truck, 'id'>) => {
    const existingRejectedTruck = orgTrucks.find(t =>
      t.truckNo.toUpperCase().trim() === truckPayload.truckNo.toUpperCase().trim() &&
      t.requestStatus === 'Rejected'
    );

    const isDup = orgTrucks.some(t =>
      t.truckNo.toUpperCase().trim() === truckPayload.truckNo.toUpperCase().trim() &&
      t.requestStatus !== 'Rejected'
    );

    if (isDup) {
      alert("Truck Number is already registered or has a pending request in this organization.");
      return;
    }

    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    const expiryStr = d.toISOString().split('T')[0];

    let targetTruckId: string;
    let newTruckObj: Truck;

    if (existingRejectedTruck) {
      targetTruckId = existingRejectedTruck.id;
      newTruckObj = mutateRecord(existingRejectedTruck, {
        ...truckPayload,
        isApproved: false,
        requestStatus: 'Rejected' as const,
        status: 'Inactive' as const,
        registrationExpiryDate: expiryStr
      }, currentUserId());
      setTrucks(prev => {
        const next = prev.map(t => t.id === targetTruckId ? newTruckObj : t);
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    } else {
      targetTruckId = (truckPayload as any).id || 'tr_' + Date.now();
      newTruckObj = createRecord<Truck>({
        ...truckPayload,
        id: targetTruckId,
        organizationId: currentUserOrgId(),
        isApproved: false,
        requestStatus: 'Rejected' as const,
        status: 'Inactive' as const,
        registrationExpiryDate: expiryStr
      }, currentUserId());
      setTrucks(prev => {
        const next = [...prev, newTruckObj];
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    }

    touchLastModified();
    logAction('Created', 'Truck', truckPayload.truckNo, `Added unsubscribed vehicle to fleet database.`);
  };

  const handleProcessTruckPayment = async (
    truckPayload: Omit<Truck, 'id'>,
    paymentDetails: {
      transactionId: string;
      amount: number;
      duration: string;
      planName: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      paymentDate: string;
      status: string;
      paymentMethod?: string;
    },
    existingTruckId?: string | null
  ) => {
    const d = new Date();
    const durationStr = paymentDetails.duration;
    if (durationStr === '1 Month') {
      d.setMonth(d.getMonth() + 1);
    } else if (durationStr === '3 Months') {
      d.setMonth(d.getMonth() + 3);
    } else if (durationStr === '6 Months') {
      d.setMonth(d.getMonth() + 6);
    } else {
      d.setFullYear(d.getFullYear() + 1);
    }
    const expiryStr = d.toISOString().split('T')[0];

    let targetTruckId = existingTruckId || ('tr_' + Date.now());
    let newTruckObj: Truck;

    const existingTruck = trucks.find(t => t.id === targetTruckId);
    if (existingTruck) {
      newTruckObj = mutateRecord(existingTruck, {
        ...truckPayload,
        isApproved: true,
        requestStatus: 'Approved' as const,
        status: 'Active' as const,
        registrationExpiryDate: expiryStr
      }, currentUserId());
      setTrucks(prev => {
        const next = prev.map(t => t.id === targetTruckId ? newTruckObj : t);
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    } else {
      newTruckObj = createRecord<Truck>({
        ...truckPayload,
        id: targetTruckId,
        organizationId: currentUserOrgId(),
        isApproved: true,
        requestStatus: 'Approved' as const,
        status: 'Active' as const,
        registrationExpiryDate: expiryStr
      }, currentUserId());
      setTrucks(prev => {
        const next = [...prev, newTruckObj];
        localStorage.setItem('ttt_trucks', JSON.stringify(next));
        return next;
      });
    }

    touchLastModified();

    const requestItem: TruckRequest = {
      id: 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      truckNo: truckPayload.truckNo.toUpperCase(),
      requestedAt: new Date().toISOString().substring(0, 10),
      status: 'Approved',
      make: truckPayload.make,
      model: truckPayload.model,
      type: truckPayload.type,
      currentKM: truckPayload.currentKM
    };

    const nextProfiles = organizationProfiles().map(p => {
      if (p.organizationId === currentUserOrgId()) {
        const cleanedRequests = (p.truckRequests || []).filter(
          r => r.truckNo.toUpperCase() !== truckPayload.truckNo.toUpperCase()
        );
        return {
          ...p,
          truckRequests: [...cleanedRequests, requestItem]
        };
      }
      return p;
    });

    try {
      await saveOrganizationProfiles(nextProfiles);
    } catch (err) {
      console.warn("Failed to update organization profiles truck requests, continuing...", err);
    }

    const activeAccounts = orgAccounts.filter(a => a.status === 'Active');
    let matchedAccount = activeAccounts.find(a => {
      if (paymentDetails.paymentMethod === 'upi') {
        return a.type === 'Digital Wallets';
      } else if (paymentDetails.paymentMethod === 'card' || paymentDetails.paymentMethod === 'netbanking') {
        return a.type === 'Bank';
      }
      return false;
    });

    if (!matchedAccount) {
      matchedAccount = activeAccounts.find(a =>
        paymentDetails.paymentMethod === 'upi' ? a.type === 'Digital Wallets' : a.type === 'Bank'
      ) || activeAccounts[0];
    }

    const paymentModeName = matchedAccount
      ? matchedAccount.accountName
      : (paymentDetails.paymentMethod === 'upi' ? 'Digital Wallets' : 'Bank');

    try {
      await addExpense({
        truckNo: truckPayload.truckNo.toUpperCase(),
        expenseType: 'Temporary',
        shopName: 'Lorry Guru Technologies',
        amount: paymentDetails.amount,
        paymentMode: paymentModeName,
        date: new Date().toISOString().split('T')[0],
        status: 'Paid',
        notes: `Subscription payment (${paymentDetails.duration}) for truck ${truckPayload.truckNo.toUpperCase()}. Transaction ID: ${paymentDetails.transactionId}. Mode: ${paymentDetails.paymentMethod || 'PhonePe'}`
      });
    } catch (expErr) {
      console.error("Failed to auto-log payment as expense:", expErr);
    }

    const paymentRecord = {
      id: 'pay_' + Date.now(),
      organizationId: currentUserOrgId(),
      truckNo: truckPayload.truckNo.toUpperCase(),
      amount: paymentDetails.amount,
      transactionId: paymentDetails.transactionId,
      paymentDate: paymentDetails.paymentDate,
      duration: paymentDetails.duration,
      status: paymentDetails.status,
      customerEmail: paymentDetails.customerEmail,
      customerName: paymentDetails.customerName,
      customerPhone: paymentDetails.customerPhone,
      paymentMethod: paymentDetails.paymentMethod || 'upi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const nextPayments = [paymentRecord, ...payments()];
    savePayments(nextPayments);

    if (isAppwriteConfigured()) {
      try {
        await appwrite.saveFleetDocument(
          'fleet_db',
          'payments',
          paymentRecord.id,
          currentUserOrgId(),
          paymentRecord
        );
      } catch (err) {
        console.error("Failed to save payment record in Appwrite:", err);
      }
    }

    logAction('Created', 'Truck', truckPayload.truckNo, `Paid ₹${paymentDetails.amount} via PhonePe. Auto-approved and validity extended to ${expiryStr}`);
    showNotification(`Truck ${truckPayload.truckNo} successfully activated! Validity extended to ${expiryStr}.`);
  };

  return {
    handleVerifyPhonePePayment,
    handleBackendUpdateTruck,
    handleAddTruckRequest,
    handleProcessTruckPayment
  };
}
