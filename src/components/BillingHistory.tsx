import React, { useState } from 'react';
import { Download, CreditCard, Receipt, FileText, Search, ShieldAlert } from 'lucide-react';

interface BillingHistoryProps {
  payments: any[];
  currentUserOrgId: string;
  orgName: string;
  gstNo: string;
  panNo: string;
  address: string;
}

export default function BillingHistory({
  payments = [],
  currentUserOrgId,
  orgName = '',
  gstNo = '',
  panNo = '',
  address = ''
}: BillingHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter payments by organization (unless backend team is viewing)
  const isBackendTeam = currentUserOrgId === 'org_backend';
  const orgPayments = isBackendTeam 
    ? payments 
    : payments.filter(p => p.organizationId === currentUserOrgId);

  // Search filter
  const filteredPayments = orgPayments.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      (p.truckNo || '').toLowerCase().includes(term) ||
      (p.transactionId || '').toLowerCase().includes(term) ||
      (p.status || '').toLowerCase().includes(term) ||
      (p.paymentDate || '').includes(term)
    );
  });

  const handleDownloadInvoice = (payment: any) => {
    const invoiceNo = 'INV-' + payment.transactionId;
    const baseAmount = (payment.amount / 1.18).toFixed(2);
    const gstAmount = (payment.amount - parseFloat(baseAmount)).toFixed(2);
    const cgst = (parseFloat(gstAmount) / 2).toFixed(2);
    const sgst = cgst;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Tax Invoice - ${invoiceNo}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 40px; line-height: 1.5; }
            .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .05); font-size: 14px; }
            .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #5f259f; padding-bottom: 20px; margin-bottom: 20px; }
            .vendor-details h2 { margin: 0; color: #5f259f; font-size: 24px; font-weight: 800; }
            .vendor-details p { margin: 4px 0; font-size: 12px; color: #666; }
            .invoice-title { text-align: right; }
            .invoice-title h1 { margin: 0; font-size: 22px; color: #333; font-weight: 800; text-transform: uppercase; }
            .invoice-title p { margin: 4px 0; font-size: 12px; color: #666; font-family: monospace; }
            .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 13px; }
            .bill-to h3 { margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #888; letter-spacing: 1px; }
            .bill-to p { margin: 4px 0; font-weight: 600; }
            .bill-to span { display: block; color: #555; margin-top: 2px; }
            .invoice-info p { margin: 4px 0; text-align: right; }
            .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .invoice-table th { background: #5f259f; color: #fff; padding: 10px; font-size: 12px; text-transform: uppercase; font-weight: 700; }
            .invoice-table td { padding: 12px 10px; border-bottom: 1px solid #eee; }
            .invoice-table .text-right { text-align: right; }
            .totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
            .totals-table { width: 250px; border-collapse: collapse; }
            .totals-table td { padding: 6px 10px; font-size: 13px; }
            .totals-table tr.grand-total td { font-weight: bold; font-size: 16px; border-top: 2px solid #5f259f; border-bottom: 2px solid #5f259f; color: #5f259f; }
            .footer { text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 20px; margin-top: 40px; }
            .paid-badge { display: inline-block; padding: 4px 10px; background: #e6f4ea; color: #137333; border: 1px solid #137333; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 12px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="invoice-header">
              <div class="vendor-details">
                <h2>Lorry Guru Technologies</h2>
                <p>Salem Main Road, Iveli</p>
                <p>Salem, Tamil Nadu, 637501</p>
                <p>GSTIN: 33AAFCL8686P1Z4 | PAN: AAFCL8686P</p>
              </div>
              <div class="invoice-title">
                <h1>Tax Invoice</h1>
                <p>No: ${invoiceNo}</p>
                <div class="paid-badge">Paid</div>
              </div>
            </div>
            
            <div class="invoice-details">
              <div class="bill-to">
                <h3>Billed To</h3>
                <p>${orgName || 'Lorry Owner'}</p>
                <span>Address: ${address || 'Not Provided'}</span>
                <span>GSTIN: ${gstNo || 'Not Provided'}</span>
                <span>PAN: ${panNo || 'Not Provided'}</span>
              </div>
              <div class="invoice-info">
                <p><strong>Invoice Date:</strong> ${new Date(payment.paymentDate).toLocaleDateString()}</p>
                <p><strong>Payment Mode:</strong> PhonePe (${payment.paymentMethod || 'UPI'})</p>
                <p><strong>Transaction Ref:</strong> ${payment.transactionId}</p>
              </div>
            </div>
            
            <table width="100%" class="invoice-table">
              <thead>
                <tr>
                  <th align="left">Description</th>
                  <th align="center">Duration</th>
                  <th align="right">Base Price</th>
                  <th align="right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Lorry Guru Fleet Software Subscription</strong><br/>
                    <span style="font-size: 11px; color: #666;">Software access subscription fee for vehicle: ${payment.truckNo}</span>
                  </td>
                  <td align="center">${payment.duration}</td>
                  <td align="right">₹${baseAmount}</td>
                  <td align="right">₹${baseAmount}</td>
                </tr>
              </tbody>
            </table>
            
            <div class="totals">
              <table class="totals-table">
                <tr>
                  <td>Subtotal (Taxable):</td>
                  <td align="right">₹${baseAmount}</td>
                </tr>
                <tr>
                  <td>CGST (9%):</td>
                  <td align="right">₹${cgst}</td>
                </tr>
                <tr>
                  <td>SGST (9%):</td>
                  <td align="right">₹${sgst}</td>
                </tr>
                <tr class="grand-total">
                  <td>Total Paid:</td>
                  <td align="right">₹${payment.amount}</td>
                </tr>
              </table>
            </div>
            
            <div class="footer">
              <p>Thank you for choosing Lorry Guru Technologies!</p>
              <p>This is a computer-generated tax invoice and does not require a physical signature.</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div id="billing-history-panel" className="space-y-6 font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              Software Subscription & Billing Invoices
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Download tax invoices and official payment receipts for your organization subscriptions.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search truck no, txn ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-slate-405 dark:text-slate-500 italic text-xs bg-slate-50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            {searchTerm ? 'No matching payment records found.' : 'No subscription payment records found in history.'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-955">
            <table className="w-full text-left text-xs divide-y divide-slate-150 dark:divide-slate-800 whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-950 font-bold text-[10px] text-slate-505 dark:text-slate-400 uppercase border-b border-slate-150 dark:border-slate-800">
                <tr>
                  <th className="p-3 pl-4">Date</th>
                  <th className="p-3">Truck No</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-350">
                {filteredPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="p-3 pl-4 text-slate-500">
                      {new Date(pay.paymentDate || pay.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-mono font-bold uppercase">{pay.truckNo}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">₹{pay.amount}</td>
                    <td className="p-3">{pay.duration}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-500">{pay.transactionId}</td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider ${
                        pay.status === 'Success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20' :
                        pay.status === 'Refunded' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20' :
                        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40'
                      }`}>
                        {pay.status}
                      </span>
                    </td>
                    <td className="p-3 text-right pr-4">
                      {pay.status === 'Success' && (
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(pay)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-blue-200 hover:border-blue-400 text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 rounded text-[10px] font-bold transition cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Invoice</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
