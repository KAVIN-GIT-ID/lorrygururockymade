interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }>;
}

type PagesFunction<Env = any> = (context: {
  request: Request;
  env: Env;
}) => Promise<Response>;

interface Env {
  VISITOR_KV?: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const currentMonth = today.substring(0, 7); // YYYY-MM
    const targetMonth = url.searchParams.get("month") || currentMonth;

    let todayUniqueCount = 0;
    let selectedMonthCount = 0;
    let availableMonths: string[] = [currentMonth];
    let dailyBreakdown: Record<string, number> = {};
    let countryBreakdown: Record<string, number> = {};

    if (env.VISITOR_KV) {
      // 1. Fetch today's count
      const dayVal = await env.VISITOR_KV.get(`c:day:${today}`);
      todayUniqueCount = dayVal ? parseInt(dayVal, 10) : 0;

      // 2. Fetch selected month count
      const monthVal = await env.VISITOR_KV.get(`c:month:${targetMonth}`);
      selectedMonthCount = monthVal ? parseInt(monthVal, 10) : 0;

      // 3. Discover available months
      const monthKeys = await env.VISITOR_KV.list({ prefix: "c:month:" });
      const foundMonths = monthKeys.keys.map(k => k.name.replace("c:month:", "")).filter(Boolean);
      if (foundMonths.length > 0) {
        availableMonths = Array.from(new Set([currentMonth, ...foundMonths])).sort().reverse();
      }

      // 4. Fetch daily breakdown for target month
      const dayKeys = await env.VISITOR_KV.list({ prefix: `c:day:${targetMonth}` });
      for (const key of dayKeys.keys) {
        const dateStr = key.name.replace("c:day:", "");
        const val = await env.VISITOR_KV.get(key.name);
        dailyBreakdown[dateStr] = val ? parseInt(val, 10) : 0;
      }

      // 5. Fetch country breakdown for target month
      const countryListKeys = await env.VISITOR_KV.list({ prefix: `c:country:${targetMonth}` });
      for (const key of countryListKeys.keys) {
        const parts = key.name.split(":");
        const countryCode = parts[3] || "UNKNOWN";
        const val = await env.VISITOR_KV.get(key.name);
        const count = val ? parseInt(val, 10) : 0;
        countryBreakdown[countryCode] = (countryBreakdown[countryCode] || 0) + count;
      }
    } else {
      // Mock stats for local dev environment
      todayUniqueCount = 1;
      selectedMonthCount = 1;
      dailyBreakdown = { [today]: 1 };
      countryBreakdown = { IN: 1 };
    }

    return new Response(
      JSON.stringify({
        success: true,
        today,
        selectedMonth: targetMonth,
        availableMonths,
        stats: {
          todayUniqueVisitors: todayUniqueCount,
          monthUniqueVisitors: selectedMonthCount,
          dailyBreakdown,
          countries: countryBreakdown
        },
        kvConfigured: Boolean(env.VISITOR_KV)
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to fetch visitor stats" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
