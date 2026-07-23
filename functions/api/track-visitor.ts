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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    // Get visitor parameters from Cloudflare edge headers
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const country = request.headers.get("cf-ipcountry") || "IN";

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const month = today.substring(0, 7); // YYYY-MM

    // Create privacy SHA-256 hash (combines IP + UserAgent + Date)
    const encoder = new TextEncoder();
    const hashData = encoder.encode(`${ip}-${userAgent}-${today}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
    const visitorHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .substring(0, 16);

    let isNewUniqueToday = false;
    let isNewUniqueMonth = false;

    if (env.VISITOR_KV) {
      // 1. Daily unique visitor check
      const dailyKey = `v:day:${today}:${visitorHash}`;
      const existingDaily = await env.VISITOR_KV.get(dailyKey);

      if (!existingDaily) {
        // Store visitor hash key expiring in 2 days
        await env.VISITOR_KV.put(dailyKey, "1", { expirationTtl: 172800 });

        // Increment today's unique count
        const dayCountKey = `c:day:${today}`;
        const rawDayCount = await env.VISITOR_KV.get(dayCountKey);
        const dayCount = parseInt(rawDayCount || "0", 10) + 1;
        await env.VISITOR_KV.put(dayCountKey, dayCount.toString());
        isNewUniqueToday = true;

        // Track Country distribution
        const countryKey = `c:country:${today}:${country}`;
        const rawCountryCount = await env.VISITOR_KV.get(countryKey);
        const countryCount = parseInt(rawCountryCount || "0", 10) + 1;
        await env.VISITOR_KV.put(countryKey, countryCount.toString());
      }

      // 2. Monthly unique visitor check
      const monthKey = `v:month:${month}:${visitorHash}`;
      const existingMonth = await env.VISITOR_KV.get(monthKey);

      if (!existingMonth) {
        // Store visitor hash key expiring in 60 days
        await env.VISITOR_KV.put(monthKey, "1", { expirationTtl: 5184000 });

        // Increment month's unique count
        const monthCountKey = `c:month:${month}`;
        const rawMonthCount = await env.VISITOR_KV.get(monthCountKey);
        const monthCount = parseInt(rawMonthCount || "0", 10) + 1;
        await env.VISITOR_KV.put(monthCountKey, monthCount.toString());
        isNewUniqueMonth = true;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        today,
        isNewUniqueToday,
        isNewUniqueMonth,
        country
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to record visitor" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
};
