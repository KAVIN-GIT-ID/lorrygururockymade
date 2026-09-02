const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/MonthlyReport.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize newlines to \n
content = content.replace(/\r\n/g, '\n');

// 1. Replace imports
content = content.replace(/import\s*\{\s*createSignal\s*\}\s*from\s*['"]solid-js['"];?/g, "import { createSignal, createMemo, For, Show } from 'solid-js';");
content = content.replace(/import\s*\{\s*BarChart,\s*Bar,\s*XAxis,\s*YAxis,\s*CartesianGrid,\s*Tooltip,\s*Legend,\s*ResponsiveContainer\s*\}\s*from\s*['"]recharts['"];?/g, "");

// 2. Convert component signature to use props
content = content.replace(/export\s*default\s*function\s*MonthlyReport\(\{\s*trips,\s*trucks,\s*expenses,\s*selectedMonth,\s*selectedYear,\s*setSelectedMonth,\s*setSelectedYear\s*\}:\s*MonthlyReportProps\)\s*\{/g, 
  "export default function MonthlyReport(props: MonthlyReportProps) {");

// 3. Read local helper variables/memos from calculations.txt
const calculations = fs.readFileSync(path.join(__dirname, 'calculations.txt'), 'utf8').replace(/\r\n/g, '\n');

// Locate and replace React calculations block
const startKeyword = "const isAllTime = selectedYear === 'All Time';";
const endKeyword = "\n  // Recharts Modern Custom Tooltip";
const startIdx = content.indexOf(startKeyword);
const endIdx = content.indexOf(endKeyword);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.slice(0, startIdx) + calculations + '\n\n  ' + content.slice(endIdx);
  console.log('Replaced calculations block successfully');
} else {
  throw new Error(`Could not locate original calculations block in MonthlyReport.tsx. startIdx=${startIdx}, endIdx=${endIdx}`);
}

// 4. Replace local variable references to evaluated memos (with lookbehinds/lookaheads)
content = content.replace(/(?<!const\s+)\bisAllTime\b(?![(]|\s*=|\s*:)/g, "isAllTime()");
content = content.replace(/(?<!const\s+)\btargetTrips\b(?![(]|\s*=|\s*:)/g, "targetTrips()");
content = content.replace(/(?<!const\s+)\btargetExpenses\b(?![(]|\s*=|\s*:)/g, "targetExpenses()");
content = content.replace(/(?<!const\s+)\bfilteredTrucks\b(?![(]|\s*=|\s*:)/g, "filteredTrucks()");
content = content.replace(/(?<!const\s+)\brawReportData\b(?![(]|\s*=|\s*:)/g, "rawReportData()");
content = content.replace(/(?<!const\s+)\btotalRevenue\b(?![(]|\s*=|\s*:)/g, "totalRevenue()");
content = content.replace(/(?<!const\s+)\btotalExpenses\b(?![(]|\s*=|\s*:)/g, "totalExpenses()");
content = content.replace(/(?<!const\s+)\bnetProfit\b(?![(]|\s*=|\s*:)/g, "netProfit()");
content = content.replace(/(?<!const\s+)\bchartData\b(?![(]|\s*=|\s*:)/g, "chartData()");

// Replace new memos
content = content.replace(/(?<!const\s+|\.)\boverallIncome\b(?![(]|\s*=|\s*:)/g, "overallIncome()");
content = content.replace(/(?<!const\s+|\.)\boverallExpenses\b(?![(]|\s*=|\s*:)/g, "overallExpenses()");
content = content.replace(/(?<!const\s+|\.)\boverallNetProfit\b(?![(]|\s*=|\s*:)/g, "overallNetProfit()");
content = content.replace(/(?<!const\s+|\.)\boverallMargin\b(?![(]|\s*=|\s*:)/g, "overallMargin()");
content = content.replace(/(?<!const\s+|\.)\btotalTripsRecorded\b(?![(]|\s*=|\s*:)/g, "totalTripsRecorded()");
content = content.replace(/(?<!const\s+|\.)\btopTruck\b(?![(]|\s*=|\s*:)/g, "topTruck()");
content = content.replace(/(?<!const\s+|\.)\bselectedMonthObj\b(?![(]|\s*=|\s*:)/g, "selectedMonthObj()");
content = content.replace(/(?<!const\s+|\.|\w)\breportData\b(?![(]|\s*=|\s*:)/g, "reportData()");

// 5. Replace props references using negative lookbehinds
content = content.replace(/(?<!props\.)\bselectedMonth\b(?!Obj)/g, "props.selectedMonth");
content = content.replace(/(?<!props\.)\bselectedYear\b/g, "props.selectedYear");
content = content.replace(/(?<!props\.)\btrucks\b(?!:)/g, "props.trucks");
content = content.replace(/(?<!props\.)\bsetSelectedMonth\b/g, "props.setSelectedMonth");
content = content.replace(/(?<!props\.)\bsetSelectedYear\b/g, "props.setSelectedYear");

// 6. Replace JSX loops with For component
content = content.replace(/\{months\.map\(m\s*=>\s*\([\s\S]*?key=\{m\.value\}[\s\S]*?<\/option>\s*\)\)\}/g, 
  `<For each={months}>{(m) => <option value={m.value}>{m.label}</option>}</For>`);
content = content.replace(/\{years\.map\(y\s*=>\s*\([\s\S]*?key=\{y\}[\s\S]*?<\/option>\s*\)\)\}/g, 
  `<For each={years}>{(y) => <option value={y}>{y}</option>}</For>`);
content = content.replace(/\{props\.trucks\.map\(t\s*=>\s*\([\s\S]*?key=\{t\.id\}[\s\S]*?<\/option>\s*\)\)\}/g, 
  `<For each={props.trucks}>{(t) => <option value={t.truckNo}>{t.truckNo}</option>}</For>`);

// 7. Remove CustomTooltip
content = content.replace(/const\s*CustomTooltip\s*=\s*\(\{[\s\S]*?\}\s*:\s*any\)\s*=>\s*\{[\s\S]*?return\s*null;\s*\};/g, "");

// 8. Replace Recharts BarChart with custom SVG Bar Chart
const svgChart = fs.readFileSync(path.join(__dirname, 'svg_chart.txt'), 'utf8').replace(/\r\n/g, '\n');
content = content.replace(/<div\s*class="w-full\s*h-80\s*min-h-\[300px\][\s\S]*?<\/ResponsiveContainer>[\s\S]*?<\/div>/g, svgChart);

// Clean className properties
content = content.replace(/className=/g, "class=");

// Restore correct interface definition
const correctInterface = `interface MonthlyReportProps {
  trips: TripEntry[];
  trucks: Truck[];
  expenses: ExpenseEntry[];
  selectedMonth: string;
  selectedYear: string;
  setSelectedMonth: (month: string) => void;
  setSelectedYear: (year: string) => void;
}`;
content = content.replace(/interface\s*MonthlyReportProps\s*\{[\s\S]*?\}/, correctInterface);

// Convert back to \r\n for Windows
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully completed precise migration of MonthlyReport.tsx');
