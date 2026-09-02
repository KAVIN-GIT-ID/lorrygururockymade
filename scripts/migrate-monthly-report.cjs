const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/MonthlyReport.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace imports
content = content.replace(/import\s*\{\s*createSignal\s*\}\s*from\s*['"]solid-js['"];?/g, "import { createSignal, createMemo, For, Show } from 'solid-js';");
content = content.replace(/import\s*\{\s*BarChart,\s*Bar,\s*XAxis,\s*YAxis,\s*CartesianGrid,\s*Tooltip,\s*Legend,\s*ResponsiveContainer\s*\}\s*from\s*['"]recharts['"];?/g, "");

// Convert component signature to use props
content = content.replace(/export\s*default\s*function\s*MonthlyReport\(\{\s*trips,\s*trucks,\s*expenses,\s*selectedMonth,\s*selectedYear,\s*setSelectedMonth,\s*setSelectedYear\s*\}:\s*MonthlyReportProps\)\s*\{/g, 
  "export default function MonthlyReport(props: MonthlyReportProps) {");

// Wrap the values in memos to react to changes in props and local state
content = content.replace(/const\s*isAllTime\s*=\s*selectedYear\s*===\s*'All Time';/g, "const isAllTime = createMemo(() => props.selectedYear === 'All Time');");
content = content.replace(/const\s*targetTrips\s*=\s*isAllTime[\s\S]*?\?\s*trips[\s\S]*?:\s*trips\.filter\([^)]*\);/g, `const targetTrips = createMemo(() => isAllTime()
    ? props.trips
    : props.trips.filter(t => t.startDate && t.startDate.startsWith(\`\${props.selectedYear}-\${props.selectedMonth}\`)));`);

content = content.replace(/const\s*targetExpenses\s*=\s*isAllTime[\s\S]*?\?\s*expenses\.filter\([^)]*\)[\s\S]*?:\s*expenses\.filter\([^)]*\);/g, `const targetExpenses = createMemo(() => isAllTime()
    ? props.expenses.filter(e => e.status !== 'Declined')
    : props.expenses.filter(e => e.date && e.date.startsWith(\`\${props.selectedYear}-\${props.selectedMonth}\`) && e.status !== 'Declined'));`);

content = content.replace(/const\s*filteredTrucks\s*=\s*selectedTruck[\s\S]*?\?\s*trucks\.filter\([^)]*\)[\s\S]*?:\s*trucks;/g, `const filteredTrucks = createMemo(() => selectedTruck()
    ? props.trucks.filter(t => t.truckNo === selectedTruck())
    : props.trucks);`);

content = content.replace(/const\s*rawReportData\s*=\s*filteredTrucks\.map\([\s\S]*?return\s*\{[\s\S]*?\}\s*\);\s*\}\s*\);/g, `const rawReportData = createMemo(() => filteredTrucks().map(truck => {
    const truckTrips = targetTrips().filter(t => t.truckNo === truck.truckNo);
    const truckGeneralExpenses = targetExpenses().filter(e => e.truckNo === truck.truckNo);

    let totalIncome = 0;
    let totalTripExpense = 0;
    const tripsCount = truckTrips.length;

    truckTrips.forEach(t => {
      const metrics = getTripMetrics(t);
      totalIncome += metrics.income;
      totalTripExpense += metrics.totalExpense;
    });

    const totalGeneralExpense = truckGeneralExpenses.reduce(
      (sum, e) => sum + (Number(e.amount) || 0), 
      0
    );

    const totalExpense = totalTripExpense + totalGeneralExpense;
    const netProfit = totalIncome - totalExpense;
    const marginPct = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
      id: truck.id,
      truckNo: truck.truckNo,
      make: truck.make || 'Tata',
      model: truck.model || 'Signa',
      type: truck.type || 'Carrier',
      tripsCount,
      totalIncome,
      totalTripExpense,
      totalGeneralExpense,
      totalExpense,
      netProfit,
      marginPct
    };
  }));`);

content = content.replace(/const\s*reportData\s*=\s*showActiveOnly[\s\S]*?\?\s*rawReportData\.filter\([^)]*\)[\s\S]*?:\s*rawReportData;/g, `const reportData = createMemo(() => showActiveOnly()
    ? rawReportData().filter(d => d.tripsCount > 0 || d.totalGeneralExpense > 0)
    : rawReportData());`);

content = content.replace(/const\s*overallIncome\s*=\s*reportData\.reduce\([^)]*\);/g, `const overallIncome = createMemo(() => reportData().reduce((sum, d) => sum + d.totalIncome, 0));`);
content = content.replace(/const\s*overallExpenses\s*=\s*reportData\.reduce\([^)]*\);/g, `const overallExpenses = createMemo(() => reportData().reduce((sum, d) => sum + d.totalExpense, 0));`);
content = content.replace(/const\s*overallNetProfit\s*=\s*overallIncome\s*-\s*overallExpenses;/g, `const overallNetProfit = createMemo(() => overallIncome() - overallExpenses());`);
content = content.replace(/const\s*overallMargin\s*=\s*overallIncome\s*>\s*0\s*\?\s*\(overallNetProfit\s*\/\s*overallIncome\)\s*\*\s*100\s*:\s*0;/g, `const overallMargin = createMemo(() => overallIncome() > 0 ? (overallNetProfit() / overallIncome()) * 100 : 0);`);
content = content.replace(/const\s*totalTripsRecorded\s*=\s*reportData\.reduce\([^)]*\);/g, `const totalTripsRecorded = createMemo(() => reportData().reduce((sum, d) => sum + d.tripsCount, 0));`);
content = content.replace(/const\s*topTruck\s*=\s*reportData\.length[\s\S]*?\?\s*\[\.\.\.reportData\]\.sort\([^)]*\)\[0\]\s*:\s*null;/g, `const topTruck = createMemo(() => reportData().length > 0
    ? [...reportData()].sort((a, b) => b.netProfit - a.netProfit)[0]
    : null);`);

content = content.replace(/const\s*chartData\s*=\s*reportData\.map\([^)]*\);/g, `const chartData = createMemo(() => reportData().map(d => ({
    name: d.truckNo,
    Income: d.totalIncome,
    Expenses: d.totalExpense,
    'Net Profit': d.netProfit
  })));`);

// Update references in calculations/JSX
content = content.replace(/\boverallIncome\b/g, "overallIncome()");
content = content.replace(/\boverallExpenses\b/g, "overallExpenses()");
content = content.replace(/\boverallNetProfit\b/g, "overallNetProfit()");
content = content.replace(/\boverallMargin\b/g, "overallMargin()");
content = content.replace(/\btotalTripsRecorded\b/g, "totalTripsRecorded()");
content = content.replace(/\btopTruck\b/g, "topTruck()");
content = content.replace(/\breportData\b/g, "reportData()");
content = content.replace(/\bchartData\b/g, "chartData()");
content = content.replace(/\bisAllTime\b/g, "isAllTime()");
content = content.replace(/\btargetExpenses\b/g, "targetExpenses()");

// Fix selectedMonth/selectedYear to props.selectedMonth / props.selectedYear
content = content.replace(/\bselectedMonth\b/g, "props.selectedMonth");
content = content.replace(/\bselectedYear\b/g, "props.selectedYear");
content = content.replace(/\btrucks\b/g, "props.trucks");
content = content.replace(/\bsetSelectedMonth\b/g, "props.setSelectedMonth");
content = content.replace(/\bsetSelectedYear\b/g, "props.setSelectedYear");

// Replace JSX loop with For
content = content.replace(/\{months\.map\(m\s*=>\s*\([\s\S]*?key=\{m\.value\}[\s\S]*?<\/option>\s*\)\)\}/g, 
  `<For each={months}>{(m) => <option value={m.value}>{m.label}</option>}</For>`);
content = content.replace(/\{years\.map\(y\s*=>\s*\([\s\S]*?key=\{y\}[\s\S]*?<\/option>\s*\)\)\}/g, 
  `<For each={years}>{(y) => <option value={y}>{y}</option>}</For>`);
content = content.replace(/\{props\.trucks\.map\(t\s*=>\s*\([\s\S]*?key=\{t\.id\}[\s\S]*?<\/option>\s*\)\)\}/g, 
  `<For each={props.trucks}>{(t) => <option value={t.truckNo}>{t.truckNo}</option>}</For>`);

// Fix tooltip components
content = content.replace(/const\s*CustomTooltip\s*=\s*\(\{[\s\S]*?\}\s*:\s*any\)\s*=>\s*\{[\s\S]*?return\s*null;\s*\};/g, "");

// Replace Recharts BarChart container with custom SVG Bar Chart
content = content.replace(/<div\s*class="w-full\s*h-80\s*min-h-\[300px\][\s\S]*?<\/ResponsiveContainer>[\s\S]*?<\/div>/g, `
            <div class="w-full overflow-x-auto pt-4">
              <div class="min-w-[600px] flex flex-col space-y-4">
                <div class="flex flex-wrap gap-4 text-[10px] font-bold justify-center pb-2 border-b border-slate-100">
                  <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 bg-blue-500 rounded-xs"></span>Income</div>
                  <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 bg-rose-500 rounded-xs"></span>Expenses</div>
                  <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 bg-emerald-500 rounded-xs"></span>Net Profit</div>
                </div>
                <div class="h-64 flex items-end gap-6 px-4">
                  <For each={chartData()}>
                    {(item) => {
                      const maxVal = Math.max(...chartData().map(d => Math.max(d.Income, d.Expenses, Math.abs(d['Net Profit']))), 1000);
                      const incHeight = (item.Income / maxVal) * 180;
                      const expHeight = (item.Expenses / maxVal) * 180;
                      const netHeight = (Math.max(0, item['Net Profit']) / maxVal) * 180;
                      return (
                        <div class="flex-1 flex flex-col items-center group relative">
                          <div class="w-full flex items-end justify-center gap-1.5 h-48 border-b border-slate-200 pb-1">
                            <div 
                              class="w-3.5 bg-blue-500 rounded-t-xs hover:bg-blue-600 transition-all cursor-pointer relative"
                              style={{ height: \`\${incHeight}px\` }}
                              title={\`Income: ₹\${item.Income.toLocaleString('en-IN')}\`}
                            />
                            <div 
                              class="w-3.5 bg-rose-500 rounded-t-xs hover:bg-rose-600 transition-all cursor-pointer relative"
                              style={{ height: \`\${expHeight}px\` }}
                              title={\`Expenses: ₹\${item.Expenses.toLocaleString('en-IN')}\`}
                            />
                            <div 
                              class="w-3.5 bg-emerald-500 rounded-t-xs hover:bg-emerald-600 transition-all cursor-pointer relative"
                              style={{ height: \`\${netHeight}px\` }}
                              title={\`Net Profit: ₹\${item['Net Profit'].toLocaleString('en-IN')}\`}
                            />
                          </div>
                          <span class="text-[10px] font-mono font-bold text-slate-650 mt-2 truncate max-w-[70px]">
                            {item.name}
                          </span>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            </div>
`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully migrated MonthlyReport.tsx to use custom SVG bar chart and SolidJS reactivity.');
