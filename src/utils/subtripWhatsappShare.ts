import { SubTrip, TripEntry } from '../types';

/**
 * Formats and opens WhatsApp with a detailed Freight Statement for a specific Sub-Trip
 */
export function shareSubTripWhatsAppStatement(trip: TripEntry, subTrip: SubTrip, subTripIndex: number = 0) {
  const loadingDate = subTrip.loadingDate || trip.startDate || 'N/A';
  const from = subTrip.routeFrom || 'N/A';
  const to = subTrip.routeTo || 'N/A';
  
  const contractFreight = subTrip.income || 0;
  // Calculate total payments received for this trip
  const advancesRecd = (trip.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
  const pendingReceivable = contractFreight - advancesRecd;
  
  const truckNo = trip.truckNo || 'N/A';
  const partyName = subTrip.officeName || 'Valued Customer';

  const message = 
`📋 *FREIGHT STATEMENT / RECEIVABLE SUMMARY*
----------------------------------------
*Truck No:* ${truckNo}
*Party:* ${partyName}
*Sub-Trip #${subTripIndex + 1}:* ${from} ➔ ${to}
*Loading Date:* ${loadingDate}

*Contract Freight:* ₹${contractFreight.toLocaleString('en-IN')}
*Advances Received:* ₹${advancesRecd.toLocaleString('en-IN')}
----------------------------------------
💰 *PENDING RECEIVABLE:* ₹${pendingReceivable.toLocaleString('en-IN')}
----------------------------------------
Thank you for your business!
_LorryGuru Fleet Logistics_`;

  const encodedUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(encodedUrl, '_blank');
}
