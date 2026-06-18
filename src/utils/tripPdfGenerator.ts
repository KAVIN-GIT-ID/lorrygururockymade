import { TripEntry, Account, getTripMetrics } from '../types';

export function generateTripPDF(trip: TripEntry, accounts: Account[]) {
  const m = getTripMetrics(trip);

  const getAccountName = (id: string) => {
    if (id === 'paid_to_driver_advance') return 'Paid to Driver Advance';
    return accounts.find(a => a.id === id)?.accountName || id || 'Unmapped';
  };

  const formatCurrency = (val: number) => {
    return '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Compile sub-trips rows
  const subTripsHtml = [...(trip.subTrips || [])].sort((a, b) => (a.loadingDate || '').localeCompare(b.loadingDate || '')).map((s, idx) => {
    // 1. Calculate segment deductions
    const segmentDeductions = (() => {
      if (s.cargoExpenses && s.cargoExpenses.length > 0) {
        return s.cargoExpenses
          .filter(exp => exp.deductedFrom === 'OrgRental')
          .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
      }
      
      let sum = 0;
      if (s.loadingDeductedFrom === 'OrgRental') sum += Number(s.loadingExpense) || 0;
      if (s.unloadingDeductedFrom === 'OrgRental') sum += Number(s.unloadingExpense) || 0;
      if (s.brokerageDeductedFrom === 'OrgRental') sum += Number(s.brokerageExpense) || 0;
      if (s.crossingDeductedFrom === 'OrgRental') sum += Number(s.crossingExpense) || 0;
      if (s.rmcDeductedFrom === 'OrgRental') sum += Number(s.rmcExpense) || 0;
      return sum;
    })();

    // 2. Calculate segment office bears
    const segmentOfficeBears = (() => {
      if (s.cargoExpenses && s.cargoExpenses.length > 0) {
        return s.cargoExpenses
          .filter(exp => exp.bears === 'Office')
          .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
      }
      return 0;
    })();

    // 3. Calculate segment payments
    const segmentPayments = (trip.payments || [])
      .filter(p => p.subTripId === s.id)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // 4. Net segment outstanding (receivable)
    const segmentReceivable = s.income - segmentDeductions + segmentOfficeBears - segmentPayments;

    return `
      <tr>
        <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
        <td>${s.routeFrom || '—'}</td>
        <td>${s.routeTo || '—'}</td>
        <td>${s.officeName || '—'}</td>
        <td style="text-align: center;">${s.material || '—'}</td>
        <td style="text-align: right;">${s.noOfTons ? s.noOfTons.toFixed(2) : '—'}</td>
        <td style="text-align: right;">${formatCurrency(s.income)}</td>
        <td style="text-align: right; color: #c2410c; font-weight: 800;">${formatCurrency(segmentReceivable)}</td>
        <td style="text-align: right;">${formatCurrency(s.loadingExpense)}</td>
        <td style="text-align: right;">${formatCurrency(s.unloadingExpense)}</td>
      </tr>
    `;
  }).join('');

  // Compile diesel purchases rows
  const fuelsHtml = [...(trip.fuels || [])].sort((a, b) => a.date.localeCompare(b.date)).map((f) => {
    return `
      <tr>
        <td style="text-align: center;">${formatDate(f.date)}</td>
        <td>${f.shopName || '—'}</td>
        <td style="text-align: right;">${f.liters ? f.liters.toFixed(2) : '—'}</td>
        <td style="text-align: right;">${formatCurrency(f.rate)}</td>
        <td style="text-align: right;">${formatCurrency(f.amount)}</td>
        <td style="text-align: center;">${f.paymentMode || '—'}</td>
      </tr>
    `;
  }).join('');

  // Advances HTML
  const advancesHtml = [...(trip.advances || [])].sort((a, b) => a.date.localeCompare(b.date)).map((a) => {
    return `
      <tr>
        <td style="text-align: center;">${formatDate(a.date)}</td>
        <td>${getAccountName(a.fromAccountId)}</td>
        <td style="text-align: right;">${formatCurrency(a.amount)}</td>
        <td>${a.notes || '—'}</td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Trip Report - ${trip.tripNo}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Mukta+Malar:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', 'Mukta Malar', sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 20px;
          background-color: #ffffff;
          font-size: 11px;
          line-height: 1.4;
        }
        
        .no-print-btn-container {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 20px;
        }

        .print-btn {
          background-color: #2563eb;
          color: white;
          border: none;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }

        .print-btn:hover {
          background-color: #1d4ed8;
        }

        @media print {
          .no-print-btn-container {
            display: none !important;
          }
          body {
            padding: 0;
          }
        }

        .header-title-box {
          border-bottom: 2px solid #2563eb;
          padding-bottom: 10px;
          margin-bottom: 15px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .header-title-box h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: #1e3a8a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .header-title-box .trip-badge {
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
          padding: 4px 8px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 12px;
        }

        /* 2-column or 3-column top grid */
        .top-meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }

        .meta-card {
          border: 1px solid #e2e8f0;
          background-color: #f8fafc;
          border-radius: 6px;
          padding: 8px 10px;
        }

        .meta-card .label {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 2px;
          display: flex;
          justify-content: space-between;
        }

        .meta-card .value {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
        }

        /* Table Styling */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }

        table th {
          background-color: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 6px 8px;
          font-size: 9px;
          text-transform: uppercase;
          border: 1px solid #cbd5e1;
        }

        table td {
          padding: 6px 8px;
          border: 1px solid #e2e8f0;
          font-size: 10px;
        }

        table tr:nth-child(even) {
          background-color: #f8fafc;
        }

        .section-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #1e3a8a;
          border-left: 3px solid #2563eb;
          padding-left: 6px;
          margin-bottom: 8px;
          margin-top: 15px;
        }

        /* Summary Split Grid */
        .split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .summary-box {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px;
          background-color: #ffffff;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dashed #e2e8f0;
        }

        .summary-row:last-child {
          border-bottom: none;
        }

        .summary-row.total {
          border-top: 1px solid #94a3b8;
          border-bottom: 1px solid #94a3b8;
          font-weight: 700;
          font-size: 11px;
          padding: 6px 0;
          margin-top: 4px;
        }

        .profit-positive {
          color: #166534;
          background-color: #f0fdf4;
        }

        .profit-negative {
          color: #991b1b;
          background-color: #fef2f2;
        }
      </style>
    </head>
    <body>
      <div class="no-print-btn-container">
        <button class="print-btn" onclick="window.print()">Print / Download PDF</button>
      </div>

      <div class="header-title-box">
        <div>
          <h1>Trip Performance Ledger</h1>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
            Fleet & Logistics Cargo Audit Report &bull; Generated on ${new Date().toLocaleDateString('en-IN')}
          </div>
        </div>
        <div class="trip-badge">${trip.tripNo}</div>
      </div>

      <div class="top-meta-grid">
        <div class="meta-card">
          <div class="label"><span>Vehicle No</span><span>வண்டி எண்</span></div>
          <div class="value" style="font-family: monospace;">${trip.truckNo}</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Driver Name</span><span>ஓட்டுநர்</span></div>
          <div class="value">${trip.driverName || '—'}</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Start Date</span><span>பு. நாள்</span></div>
          <div class="value">${formatDate(trip.startDate)}</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>End Date</span><span>மு. நாள்</span></div>
          <div class="value">${formatDate(trip.endDate)}</div>
        </div>

        <div class="meta-card">
          <div class="label"><span>Start KM</span><span>STA KM</span></div>
          <div class="value">${trip.startingKM || 0} KM</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>End KM</span><span>END KM</span></div>
          <div class="value">${trip.endingKM || 0} KM</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Total KM</span><span>TOTAL KM</span></div>
          <div class="value" style="color: #2563eb;">${m.totalKM} KM</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Duration</span><span>நாட்கள்</span></div>
          <div class="value">${m.noOfDays} Days</div>
        </div>

        <div class="meta-card">
          <div class="label"><span>Diesel Liters</span><span>டீசல்</span></div>
          <div class="value">${m.fuelLiters.toFixed(2)} L</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Mileage</span><span>மைலேஜ்</span></div>
          <div class="value" style="color: #c2410c;">${m.fuelLiters > 0 ? m.millage.toFixed(2) : '0.00'} KM/L</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Outstanding</span><span>மீதி</span></div>
          <div class="value" style="color: #b91c1c;">${formatCurrency(m.outstandingBalance)}</div>
        </div>
        <div class="meta-card" style="background-color: #f0fdf4; border-color: #bbf7d0;">
          <div class="label" style="color: #166534;"><span>Net Profit</span><span>லாபம்</span></div>
          <div class="value" style="color: #166534;">${formatCurrency(m.profit)}</div>
        </div>
      </div>

      <div class="section-title">Sub-Trip Journey Segments / ஏற்றுமதி விவரம்</div>
      <table>
        <thead>
          <tr>
            <th style="width: 10%; text-align: center;">Date / தேதி</th>
            <th style="width: 13%;">From / ஏற்றுமிடம்</th>
            <th style="width: 13%;">To / இறங்குமிடம்</th>
            <th style="width: 13%;">Office / ஆபீஸ்</th>
            <th style="width: 10%; text-align: center;">Material</th>
            <th style="width: 7%; text-align: right;">Weight / எடை</th>
            <th style="width: 10%; text-align: right;">Freight / வாடகை</th>
            <th style="font-weight: 800; color: #c2410c; width: 10%; text-align: right;">Outstanding / மீதி</th>
            <th style="width: 9%; text-align: right;">Load Wage</th>
            <th style="width: 9%; text-align: right;">Unload Wage</th>
          </tr>
        </thead>
        <tbody>
          ${subTripsHtml || '<tr><td colspan="10" style="text-align: center; color: #64748b;">No sub-trips recorded for this ledger</td></tr>'}
        </tbody>
      </table>

      <div class="split-grid">
        <div>
          <div class="section-title">Diesel Refuels / டீசல் கொள்முதல்</div>
          <table style="margin-bottom: 15px;">
            <thead>
              <tr>
                <th style="text-align: center; width: 18%;">Date</th>
                <th>Station / Bunk</th>
                <th style="text-align: right; width: 15%;">Liters</th>
                <th style="text-align: right; width: 15%;">Rate</th>
                <th style="text-align: right; width: 18%;">Rupees</th>
                <th style="text-align: center; width: 15%;">Mode</th>
              </tr>
            </thead>
            <tbody>
              ${fuelsHtml || '<tr><td colspan="6" style="text-align: center; color: #64748b;">No diesel entries recorded</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">Driver Advances Received / அட்வான்ஸ்</div>
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 20%;">Date</th>
                <th>Account / Source</th>
                <th style="text-align: right; width: 25%;">Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${advancesHtml || '<tr><td colspan="4" style="text-align: center; color: #64748b;">No advances registered</td></tr>'}
            </tbody>
          </table>
        </div>

        <div>
          <div class="section-title">Trip Expense Summary / செலவு விவரம்</div>
          <div class="summary-box">
            <div class="summary-row">
              <span>Commission Expense (கமிசன்)</span>
              <strong>${formatCurrency(m.brokerageExpense)}</strong>
            </div>
            <div class="summary-row">
              <span>Loading Wages (ஏற்றுக்கூலி)</span>
              <strong>${formatCurrency(m.loadingExpense)}</strong>
            </div>
            <div class="summary-row">
              <span>Unloading Wages (இறக்குக்கூலி)</span>
              <strong>${formatCurrency(m.unloadingExpense)}</strong>
            </div>
            <div class="summary-row">
              <span>Diesel / Fuel Cost (டீசல் செலவு)</span>
              <strong>${formatCurrency(m.dieselExpense)}</strong>
            </div>
            <div class="summary-row">
              <span>Add Blue Expense</span>
              <strong>${formatCurrency(m.addBlueExpense)}</strong>
            </div>
            <div class="summary-row">
              <span>Fastag Expense</span>
              <strong>${formatCurrency(m.fastagExpense)}</strong>
            </div>
            <div class="summary-row">
              <span>Driver Wages & Batta (டிரைவர் படி)</span>
              <strong>${formatCurrency(m.driverWages)}</strong>
            </div>
            <div class="summary-row">
              <span>Crossing Expense</span>
              <strong>${formatCurrency(m.crossingExpense)}</strong>
            </div>
            <div class="summary-row">
              <span>RTO + Police Checkpost (செக்போஸ்ட்)</span>
              <strong>${formatCurrency(m.rtoExpense)}</strong>
            </div>
            <div class="summary-row">
              <span>Other Misc Expense (இதர செலவுகள்)</span>
              <strong>${formatCurrency(m.otherExpense)}</strong>
            </div>
            <div class="summary-row total">
              <span>Total Operating Cost (மொத்த செலவு)</span>
              <span style="color: #b91c1c;">${formatCurrency(m.totalExpense)}</span>
            </div>
          </div>

          <div class="section-title">Net Financial Summary / இறுதி கணக்கு</div>
          <div class="summary-box" style="background-color: #fafafa; border-color: #94a3b8;">
            <div class="summary-row">
              <span>Gross Rental Freight Received (மொத்த வாடகை)</span>
              <strong>${formatCurrency(m.income)}</strong>
            </div>
            <div class="summary-row">
              <span>Office Rental Deductions (ஆபீஸ் பிடித்தம்)</span>
              <strong style="color: #b91c1c;">-${formatCurrency(m.totalOrgRentalDeductions)}</strong>
            </div>
            <div class="summary-row">
              <span>Payments Collected (பெற்ற வரவு)</span>
              <strong>${formatCurrency(m.paymentsReceived)}</strong>
            </div>
            <div class="summary-row">
              <span>Outstanding Balance (நிறுவன மீதி)</span>
              <strong style="color: #b91c1c;">${formatCurrency(m.outstandingBalance)}</strong>
            </div>
            <div class="summary-row total" style="background-color: #f0fdf4;">
              <span>Net Profit Margin (மீதி லாபம்)</span>
              <span style="color: #166534;">${formatCurrency(m.profit)}</span>
            </div>
            <div class="summary-row" style="margin-top: 8px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
              <span>Driver Balance (ஓட்டுநர் கணக்கு)</span>
              <strong style="color: ${m.driverBalance >= 0 ? '#166534' : '#b91c1c'};">
                ${m.driverBalance >= 0 ? 'Pay Driver: ' : 'Recover: '}${formatCurrency(Math.abs(m.driverBalance))}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
}

export function generateDriverReportPDF(trip: TripEntry, accounts: Account[]) {
  const m = getTripMetrics(trip);

  const getAccountName = (id: string) => {
    if (id === 'paid_to_driver_advance') return 'Paid to Driver Advance';
    return accounts.find(a => a.id === id)?.accountName || id || 'Unmapped';
  };

  const formatCurrency = (val: number) => {
    return '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Compile driver credit details
  // 1. Driver Wages
  const wagesHtml = [...(trip.subTrips || [])].sort((a, b) => (a.loadingDate || '').localeCompare(b.loadingDate || '')).map((s, idx) => {
    if (!s.driverWages) return '';
    return `
      <tr>
        <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
        <td>Wages: ${s.routeFrom || '—'} &rarr; ${s.routeTo || '—'} (${s.material || 'Material'})</td>
        <td style="text-align: right;">${formatCurrency(s.driverWages)}</td>
      </tr>
    `;
  }).join('');

  // 2. Fuel Paid by Driver
  const fuelsPaidByDriverHtml = [...(trip.fuels || [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(f => f.paymentMode === 'driver' || f.paymentMode === 'Driver')
    .map(f => `
      <tr>
        <td style="text-align: center;">${formatDate(f.date)}</td>
        <td>Fuel Refuel: ${f.shopName || 'Bunk'} (${f.liters ? f.liters.toFixed(2) : '0'} L @ ${formatCurrency(f.rate)})</td>
        <td style="text-align: right;">${formatCurrency(f.amount)}</td>
      </tr>
    `).join('');

  // 3. Trip-level Expenses Paid by Driver
  const tripLevelExpensesPaidByDriver: { name: string; amount: number }[] = [];
  if (trip.rtoPaidByDriver && trip.rtoExpense) tripLevelExpensesPaidByDriver.push({ name: 'RTO / Checkpost Expense', amount: trip.rtoExpense });
  if (trip.addBluePaidByDriver && trip.addBlueExpense) tripLevelExpensesPaidByDriver.push({ name: 'Add Blue Expense', amount: trip.addBlueExpense });
  if (trip.fastagPaidByDriver && trip.fastagExpense) tripLevelExpensesPaidByDriver.push({ name: 'Fastag Expense', amount: trip.fastagExpense });
  if (trip.otherPaidByDriver && trip.otherExpense) tripLevelExpensesPaidByDriver.push({ name: 'Other Misc Expense', amount: trip.otherExpense });

  const tripLevelExpensesPaidHtml = tripLevelExpensesPaidByDriver.map(e => `
    <tr>
      <td style="text-align: center;">—</td>
      <td>Common Trip Expense: ${e.name}</td>
      <td style="text-align: right;">${formatCurrency(e.amount)}</td>
    </tr>
  `).join('');

  // 4. Cargo Expenses Paid by Driver
  const cargoExpensesPaidByDriverHtml = [...(trip.subTrips || [])]
    .sort((a, b) => (a.loadingDate || '').localeCompare(b.loadingDate || ''))
    .flatMap(s => {
    if (s.cargoExpenses && s.cargoExpenses.length > 0) {
      return s.cargoExpenses
        .filter(exp => exp.paidByDriver && (exp.bears === 'Org' || exp.bears === 'Office'))
        .map(exp => `
          <tr>
            <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
            <td>Cargo ${exp.expenseType} Expense (Paid by Driver, Borne by ${exp.bears})</td>
            <td style="text-align: right;">${formatCurrency(exp.amount)}</td>
          </tr>
        `);
    }
    // Legacy fallback
    const legacyExp: string[] = [];
    if (s.loadingPaidByDriver && s.loadingExpense && (s.loadingBears || 'Org') === 'Org') {
      legacyExp.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo Loading (Paid by Driver)</td>
          <td style="text-align: right;">${formatCurrency(s.loadingExpense)}</td>
        </tr>
      `);
    }
    if (s.unloadingPaidByDriver && s.unloadingExpense && (s.unloadingBears || 'Org') === 'Org') {
      legacyExp.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo Unloading (Paid by Driver)</td>
          <td style="text-align: right;">${formatCurrency(s.unloadingExpense)}</td>
        </tr>
      `);
    }
    if (s.brokeragePaidByDriver && s.brokerageExpense && s.brokerageBears === 'Org') {
      legacyExp.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo Brokerage (Paid by Driver)</td>
          <td style="text-align: right;">${formatCurrency(s.brokerageExpense)}</td>
        </tr>
      `);
    }
    if (s.crossingPaidByDriver && s.crossingExpense && (s.crossingBears || 'Org') === 'Org') {
      legacyExp.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo Crossing (Paid by Driver)</td>
          <td style="text-align: right;">${formatCurrency(s.crossingExpense)}</td>
        </tr>
      `);
    }
    if (s.rmcPaidByDriver && s.rmcExpense && (s.rmcBears || 'Org') === 'Org') {
      legacyExp.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo RMC (Paid by Driver)</td>
          <td style="text-align: right;">${formatCurrency(s.rmcExpense)}</td>
        </tr>
      `);
    }
    return legacyExp;
  }).join('');

  const creditsHtml = [wagesHtml, fuelsPaidByDriverHtml, tripLevelExpensesPaidHtml, cargoExpensesPaidByDriverHtml].filter(Boolean).join('');

  // Compile driver advances / debits details
  // 1. Trip Advances
  const advancesListHtml = [...(trip.advances || [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(a => `
    <tr>
      <td style="text-align: center;">${formatDate(a.date)}</td>
      <td>Advance: ${getAccountName(a.fromAccountId)} ${a.notes ? `(${a.notes})` : ''}</td>
      <td style="text-align: right;">${formatCurrency(a.amount)}</td>
    </tr>
  `).join('');

  // 2. Payments marked as driver advance
  const driverAdvancePaymentsHtml = [...(trip.payments || [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter(p => p.receivedBy === 'paid_to_driver_advance')
    .map(p => `
      <tr>
        <td style="text-align: center;">${formatDate(p.date)}</td>
        <td>Direct Payment: ${p.notes || 'Driver Advance Receipt'}</td>
        <td style="text-align: right;">${formatCurrency(p.amount)}</td>
      </tr>
    `).join('');

  const debitsHtml = [advancesListHtml, driverAdvancePaymentsHtml].filter(Boolean).join('');

  // Compile recoveries/deductions
  const recoveriesHtml = [...(trip.subTrips || [])]
    .sort((a, b) => (a.loadingDate || '').localeCompare(b.loadingDate || ''))
    .flatMap(s => {
    if (s.cargoExpenses && s.cargoExpenses.length > 0) {
      return s.cargoExpenses
        .filter(exp => exp.bears === 'Driver' && !exp.paidByDriver)
        .map(exp => `
          <tr>
            <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
            <td>Cargo ${exp.expenseType} (Borne by Driver, Paid by Office/Org)</td>
            <td style="text-align: right;">${formatCurrency(exp.amount)}</td>
          </tr>
        `);
    }
    // Legacy fallback
    const legacyRec: string[] = [];
    if (!s.loadingPaidByDriver && s.loadingExpense && s.loadingBears === 'Driver') {
      legacyRec.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo Loading (Driver Borne, Paid by Org)</td>
          <td style="text-align: right;">${formatCurrency(s.loadingExpense)}</td>
        </tr>
      `);
    }
    if (!s.unloadingPaidByDriver && s.unloadingExpense && s.unloadingBears === 'Driver') {
      legacyRec.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo Unloading (Driver Borne, Paid by Org)</td>
          <td style="text-align: right;">${formatCurrency(s.unloadingExpense)}</td>
        </tr>
      `);
    }
    if (!s.brokeragePaidByDriver && s.brokerageExpense && (s.brokerageBears || 'Driver') === 'Driver') {
      legacyRec.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo Brokerage (Driver Borne, Paid by Org)</td>
          <td style="text-align: right;">${formatCurrency(s.brokerageExpense)}</td>
        </tr>
      `);
    }
    if (!s.crossingPaidByDriver && s.crossingExpense && s.crossingBears === 'Driver') {
      legacyRec.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo Crossing (Driver Borne, Paid by Org)</td>
          <td style="text-align: right;">${formatCurrency(s.crossingExpense)}</td>
        </tr>
      `);
    }
    if (!s.rmcPaidByDriver && s.rmcExpense && s.rmcBears === 'Driver') {
      legacyRec.push(`
        <tr>
          <td style="text-align: center;">${formatDate(s.loadingDate)}</td>
          <td>Cargo RMC (Driver Borne, Paid by Org)</td>
          <td style="text-align: right;">${formatCurrency(s.rmcExpense)}</td>
        </tr>
      `);
    }
    return legacyRec;
  }).join('');

  // Calculate totals
  // Fuels paid by driver
  const fuelsDriverSpend = (trip.fuels || []).reduce((sum, f) => {
    if (f.paymentMode === 'driver' || f.paymentMode === 'Driver') {
      return sum + (Number(f.amount) || 0);
    }
    return sum;
  }, 0);

  // Common trip-level expenses paid by driver
  let tripLevelDriverSpend = 0;
  if (trip.rtoPaidByDriver && trip.rtoExpense) tripLevelDriverSpend += trip.rtoExpense;
  if (trip.addBluePaidByDriver && trip.addBlueExpense) tripLevelDriverSpend += trip.addBlueExpense;
  if (trip.fastagPaidByDriver && trip.fastagExpense) tripLevelDriverSpend += trip.fastagExpense;
  if (trip.otherPaidByDriver && trip.otherExpense) tripLevelDriverSpend += trip.otherExpense;

  // Driver paid cargo direct
  let driverPaidDirectCargo = 0;
  for (const s of trip.subTrips || []) {
    if (s.cargoExpenses && s.cargoExpenses.length > 0) {
      for (const exp of s.cargoExpenses) {
        if (exp.paidByDriver && (exp.bears === 'Org' || exp.bears === 'Office')) {
          driverPaidDirectCargo += Number(exp.amount) || 0;
        }
      }
    } else {
      if (s.loadingPaidByDriver && s.loadingExpense && (s.loadingBears || 'Org') === 'Org') driverPaidDirectCargo += Number(s.loadingExpense) || 0;
      if (s.unloadingPaidByDriver && s.unloadingExpense && (s.unloadingBears || 'Org') === 'Org') driverPaidDirectCargo += Number(s.unloadingExpense) || 0;
      if (s.brokeragePaidByDriver && s.brokerageExpense && s.brokerageBears === 'Org') driverPaidDirectCargo += Number(s.brokerageExpense) || 0;
      if (s.crossingPaidByDriver && s.crossingExpense && (s.crossingBears || 'Org') === 'Org') driverPaidDirectCargo += Number(s.crossingExpense) || 0;
      if (s.rmcPaidByDriver && s.rmcExpense && (s.rmcBears || 'Org') === 'Org') driverPaidDirectCargo += Number(s.rmcExpense) || 0;
    }
  }

  const driverWagesVal = (trip.subTrips || []).reduce((sum, s) => sum + (Number(s.driverWages) || 0), 0);
  const totalDriverSpend = fuelsDriverSpend + tripLevelDriverSpend + driverPaidDirectCargo + driverWagesVal;

  const category4CategoryAdvances = (trip.advances || []).reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const category3DriverAdvancePayments = (trip.payments || [])
    .filter(p => p.receivedBy === 'paid_to_driver_advance')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalIssuedToDriver = category4CategoryAdvances + category3DriverAdvancePayments;

  let driverRecoveryVal = 0;
  for (const s of trip.subTrips || []) {
    if (s.cargoExpenses && s.cargoExpenses.length > 0) {
      for (const exp of s.cargoExpenses) {
        if (exp.bears === 'Driver' && !exp.paidByDriver) {
          driverRecoveryVal += Number(exp.amount) || 0;
        }
      }
    } else {
      if (!s.loadingPaidByDriver && s.loadingExpense && s.loadingBears === 'Driver') driverRecoveryVal += Number(s.loadingExpense) || 0;
      if (!s.unloadingPaidByDriver && s.unloadingExpense && s.unloadingBears === 'Driver') driverRecoveryVal += Number(s.unloadingExpense) || 0;
      if (!s.brokeragePaidByDriver && s.brokerageExpense && (s.brokerageBears || 'Driver') === 'Driver') driverRecoveryVal += Number(s.brokerageExpense) || 0;
      if (!s.crossingPaidByDriver && s.crossingExpense && s.crossingBears === 'Driver') driverRecoveryVal += Number(s.crossingExpense) || 0;
      if (!s.rmcPaidByDriver && s.rmcExpense && s.rmcBears === 'Driver') driverRecoveryVal += Number(s.rmcExpense) || 0;
    }
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Driver Report - ${trip.tripNo}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Mukta+Malar:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', 'Mukta Malar', sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 20px;
          background-color: #ffffff;
          font-size: 11px;
          line-height: 1.4;
        }
        
        .no-print-btn-container {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 20px;
        }

        .print-btn {
          background-color: #4f46e5;
          color: white;
          border: none;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }

        .print-btn:hover {
          background-color: #4338ca;
        }

        @media print {
          .no-print-btn-container {
            display: none !important;
          }
          body {
            padding: 0;
          }
        }

        .header-title-box {
          border-bottom: 2px solid #4f46e5;
          padding-bottom: 10px;
          margin-bottom: 15px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .header-title-box h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          color: #312e81;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .header-title-box .trip-badge {
          background-color: #e0e7ff;
          border: 1px solid #c7d2fe;
          color: #3730a3;
          padding: 4px 8px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 12px;
        }

        /* Top metadata grid */
        .top-meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }

        .meta-card {
          border: 1px solid #e2e8f0;
          background-color: #f8fafc;
          border-radius: 6px;
          padding: 8px 10px;
        }

        .meta-card .label {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 2px;
          display: flex;
          justify-content: space-between;
        }

        .meta-card .value {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
        }

        /* Table Styling */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        table th {
          background-color: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-align: left;
          padding: 6px 8px;
          font-size: 9px;
          text-transform: uppercase;
          border: 1px solid #cbd5e1;
        }

        table td {
          padding: 6px 8px;
          border: 1px solid #e2e8f0;
          font-size: 10px;
        }

        table tr:nth-child(even) {
          background-color: #f8fafc;
        }

        .section-title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          color: #312e81;
          border-left: 3px solid #4f46e5;
          padding-left: 6px;
          margin-bottom: 8px;
          margin-top: 15px;
        }

        /* Summary Split Grid */
        .split-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .summary-box {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px;
          background-color: #ffffff;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dashed #e2e8f0;
        }

        .summary-row:last-child {
          border-bottom: none;
        }

        .summary-row.total {
          border-top: 1px solid #94a3b8;
          border-bottom: 1px solid #94a3b8;
          font-weight: 700;
          font-size: 11px;
          padding: 6px 0;
          margin-top: 4px;
        }

        .signature-section {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          padding: 0 20px;
        }

        .signature-box {
          border-top: 1px solid #94a3b8;
          width: 200px;
          text-align: center;
          padding-top: 5px;
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="no-print-btn-container">
        <button class="print-btn" onclick="window.print()">Print / Download PDF</button>
      </div>

      <div class="header-title-box">
        <div>
          <h1>Driver Settlement Ledger</h1>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
            Driver Earnings, Advances & Recoveries Statement &bull; Generated on ${new Date().toLocaleDateString('en-IN')}
          </div>
        </div>
        <div class="trip-badge">${trip.tripNo}</div>
      </div>

      <div class="top-meta-grid">
        <div class="meta-card">
          <div class="label"><span>Driver Name</span><span>ஓட்டுநர் பெயர்</span></div>
          <div class="value">${trip.driverName || '—'}</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Vehicle No</span><span>வண்டி எண்</span></div>
          <div class="value" style="font-family: monospace;">${trip.truckNo}</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Start Date</span><span>துவக்க நாள்</span></div>
          <div class="value">${formatDate(trip.startDate)}</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>End Date</span><span>முடிவு நாள்</span></div>
          <div class="value">${formatDate(trip.endDate)}</div>
        </div>

        <div class="meta-card">
          <div class="label"><span>Start KM</span><span>துவக்க கி.மீ</span></div>
          <div class="value">${trip.startingKM || 0} KM</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>End KM</span><span>முடிவு கி.மீ</span></div>
          <div class="value">${trip.endingKM || 0} KM</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Total KM</span><span>மொத்த கி.மீ</span></div>
          <div class="value" style="color: #4f46e5;">${m.totalKM} KM</div>
        </div>
        <div class="meta-card">
          <div class="label"><span>Trip Duration</span><span>நாட்கள்</span></div>
          <div class="value">${m.noOfDays} Days</div>
        </div>
      </div>

      <div class="section-title">1. Driver Earnings & Spent / ஓட்டுநர் வரவுகள்</div>
      <table>
        <thead>
          <tr>
            <th style="width: 15%; text-align: center;">Date / தேதி</th>
            <th>Description / விவரம்</th>
            <th style="width: 20%; text-align: right;">Amount / தொகை</th>
          </tr>
        </thead>
        <tbody>
          ${creditsHtml || '<tr><td colspan="3" style="text-align: center; color: #64748b;">No earnings or driver spends recorded</td></tr>'}
          <tr style="font-weight: 700; background-color: #f1f5f9;">
            <td colspan="2" style="text-align: right;">Total Credits (A):</td>
            <td style="text-align: right; color: #166534;">${formatCurrency(totalDriverSpend)}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">2. Advances Issued / வழங்கிய அட்வான்ஸ்</div>
      <table>
        <thead>
          <tr>
            <th style="width: 15%; text-align: center;">Date / தேதி</th>
            <th>Description / விவரம்</th>
            <th style="width: 20%; text-align: right;">Amount / தொகை</th>
          </tr>
        </thead>
        <tbody>
          ${debitsHtml || '<tr><td colspan="3" style="text-align: center; color: #64748b;">No advances issued</td></tr>'}
          <tr style="font-weight: 700; background-color: #f1f5f9;">
            <td colspan="2" style="text-align: right;">Total Advances Issued (B):</td>
            <td style="text-align: right; color: #b91c1c;">${formatCurrency(totalIssuedToDriver)}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">3. Recoveries & Deductions / பிடித்தங்கள்</div>
      <table>
        <thead>
          <tr>
            <th style="width: 15%; text-align: center;">Date / தேதி</th>
            <th>Description / விவரம்</th>
            <th style="width: 20%; text-align: right;">Amount / தொகை</th>
          </tr>
        </thead>
        <tbody>
          ${recoveriesHtml || '<tr><td colspan="3" style="text-align: center; color: #64748b;">No driver recoveries recorded</td></tr>'}
          <tr style="font-weight: 700; background-color: #f1f5f9;">
            <td colspan="2" style="text-align: right;">Total Recoveries (C):</td>
            <td style="text-align: right; color: #b91c1c;">${formatCurrency(driverRecoveryVal)}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">Summary Statement / இறுதி கணக்கு</div>
      <div class="summary-box" style="background-color: #fafafa; border: 2px solid #cbd5e1; max-width: 500px; margin-bottom: 30px;">
        <div class="summary-row">
          <span>Driver Total Spends & Wages (A)</span>
          <strong>${formatCurrency(totalDriverSpend)}</strong>
        </div>
        <div class="summary-row">
          <span>Advances Received by Driver (B)</span>
          <strong style="color: #b91c1c;">-${formatCurrency(totalIssuedToDriver)}</strong>
        </div>
        <div class="summary-row">
          <span>Recoverable Deductions (C)</span>
          <strong style="color: #b91c1c;">-${formatCurrency(driverRecoveryVal)}</strong>
        </div>
        <div class="summary-row total" style="background-color: ${m.driverBalance >= 0 ? '#f0fdf4' : '#fef2f2'}; border-color: ${m.driverBalance >= 0 ? '#bbf7d0' : '#fecaca'};">
          <span style="font-size: 12px;">Net Balance (A - B - C)</span>
          <span style="font-size: 12px; color: ${m.driverBalance >= 0 ? '#166534' : '#b91c1c'}; font-weight: 800;">
            ${m.driverBalance >= 0 ? 'Pay Driver: ' : 'Recover: '}${formatCurrency(Math.abs(m.driverBalance))}
          </span>
        </div>
      </div>

      <div class="signature-section">
        <div class="signature-box">Driver Signature</div>
        <div class="signature-box">Authorized Signatory</div>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
}

