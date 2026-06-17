import fs from 'fs';
import path from 'path';

const backupsDir = 'backups';
const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(backupsDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.trips && data.trips.length > 0) {
      const tripWithPayments = data.trips.find(t => t.payments && t.payments.some(p => p.subTripId));
      if (tripWithPayments) {
        console.log(`File: ${file}`);
        console.log(`  Trip No: ${tripWithPayments.tripNo}`);
        console.log(`  SubTrips count: ${tripWithPayments.subTrips ? tripWithPayments.subTrips.length : 0}`);
        const pSample = tripWithPayments.payments.find(p => p.subTripId);
        console.log(`  Payment subTripId sample: ${pSample.subTripId}`);
        if (tripWithPayments.subTrips && tripWithPayments.subTrips.some(st => st.id === pSample.subTripId)) {
          console.log(`  -> Match found! SubTrip array contains the payment's subTripId.`);
        } else {
          console.log(`  -> NO MATCH in subTrips array.`);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
  }
}
