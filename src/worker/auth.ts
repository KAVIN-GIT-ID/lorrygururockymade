import { Env, UserClaims } from './types.js';
import { hashPassword, verifyPassword, createJWT, verifyJWT, generateId, getEmailDocId } from './crypto.js';

export async function extractUser(request: Request, env: Env): Promise<UserClaims | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  const secret = env.JWT_SECRET || 'ttt-super-secret-cloudflare-d1-worker-jwt-key-2026';
  return await verifyJWT(token, secret);
}

export async function sendTwilioMessage(
  env: Env,
  rawPhone: string,
  bodyText: string,
  isWhatsApp: boolean = true
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return { success: false, error: 'Twilio credentials not configured' };
  }

  // Clean and format phone number with E.164 standard
  let cleanPhone = String(rawPhone).replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (!cleanPhone.startsWith('+')) {
    if (cleanPhone.length === 10) cleanPhone = '+91' + cleanPhone;
    else cleanPhone = '+' + cleanPhone;
  }

  const fromNumber = isWhatsApp 
    ? `whatsapp:${env.TWILIO_WHATSAPP_NUMBER || '+14155238886'}`
    : (env.TWILIO_PHONE_NUMBER || '+14155238886');

  const toNumber = isWhatsApp ? `whatsapp:${cleanPhone}` : cleanPhone;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams();
  params.append('To', toNumber);
  params.append('From', fromNumber);
  params.append('Body', bodyText);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await res.json() as any;
    if (res.ok && data.sid) {
      console.log(`[Twilio] Message delivered to ${toNumber}. SID: ${data.sid}`);
      return { success: true, sid: data.sid };
    } else {
      console.warn(`[Twilio] Delivery error to ${toNumber}:`, data.message || data);
      return { success: false, error: data.message || 'Twilio send failed' };
    }
  } catch (err: any) {
    console.error('[Twilio] Fetch exception:', err);
    return { success: false, error: err.message };
  }
}

export async function handleAuth(request: Request, env: Env, pathname: string): Promise<Response> {
  const secret = env.JWT_SECRET || 'ttt-super-secret-cloudflare-d1-worker-jwt-key-2026';

  if (pathname === '/api/auth/register' && request.method === 'POST') {
    const { email, password, name, phone, organizationId, role } = await request.json() as any;
    if (!email || !password || !name) {
      return Response.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(cleanEmail).first();
    if (existing) {
      return Response.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const userId = generateId('usr_');
    const pwdHash = await hashPassword(password);
    const orgId = organizationId || 'org_default';
    const userRole = role || (cleanEmail.includes('admin') ? 'Admin' : 'Owner');

    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, name, phone, organization_id, role, email_verified, phone_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
    `).bind(userId, cleanEmail, pwdHash, name.trim(), phone || '', orgId, userRole).run();

    // Also insert or sync into global_configs for backward compatibility
    const userDocId = getEmailDocId(cleanEmail);
    const userConfigData = {
      id: userId,
      email: cleanEmail,
      name: name.trim(),
      phone: phone || '',
      role: userRole,
      organizationId: orgId,
      isEmailVerified: true,
      isPhoneVerified: false,
      permissions: ['read', 'write']
    };
    await env.DB.prepare(`
      INSERT INTO global_configs (key, data, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
    `).bind(userDocId, JSON.stringify(userConfigData)).run();

    const token = await createJWT({
      userId,
      email: cleanEmail,
      name: name.trim(),
      role: userRole,
      organizationId: orgId,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600) // 30 days
    }, secret);

    return Response.json({
      success: true,
      user: {
        $id: userId,
        id: userId,
        name: name.trim(),
        email: cleanEmail,
        phone: phone || '',
        emailVerification: true,
        phoneVerification: false,
        organizationId: orgId,
        role: userRole
      },
      jwt: token
    });
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const { email, password } = await request.json() as any;
    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail).first() as any;

    if (!user) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Check rights from global_configs if exists
    let orgId = user.organization_id || 'org_default';
    let role = user.role || 'Custom';
    try {
      const cfgDoc = await env.DB.prepare('SELECT data FROM global_configs WHERE key = ?').bind(getEmailDocId(cleanEmail)).first() as any;
      if (cfgDoc?.data) {
        const parsed = JSON.parse(cfgDoc.data);
        if (parsed.organizationId) orgId = parsed.organizationId;
        if (parsed.role) role = parsed.role;
      }
    } catch (_) {}

    const token = await createJWT({
      userId: user.id,
      email: cleanEmail,
      name: user.name,
      role,
      organizationId: orgId,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600)
    }, secret);

    return Response.json({
      success: true,
      user: {
        $id: user.id,
        id: user.id,
        name: user.name,
        email: cleanEmail,
        phone: user.phone || '',
        emailVerification: !!user.email_verified,
        phoneVerification: !!user.phone_verified,
        organizationId: orgId,
        role
      },
      jwt: token
    });
  }

  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const userClaims = await extractUser(request, env);
    if (!userClaims) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ? OR email = ?').bind(userClaims.userId, userClaims.email).first() as any;
    if (!user) {
      const userObj = {
        $id: userClaims.userId,
        id: userClaims.userId,
        name: userClaims.name,
        email: userClaims.email,
        emailVerification: true,
        phoneVerification: false,
        organizationId: userClaims.organizationId,
        role: userClaims.role
      };
      return Response.json({
        ...userObj,
        user: userObj
      });
    }

    const userObj = {
      $id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      emailVerification: !!user.email_verified,
      phoneVerification: !!user.phone_verified,
      organizationId: userClaims.organizationId || user.organization_id,
      role: userClaims.role || user.role
    };

    return Response.json({
      ...userObj,
      user: userObj
    });
  }

  if (pathname === '/api/auth/jwt' && request.method === 'POST') {
    const userClaims = await extractUser(request, env);
    if (!userClaims) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = await createJWT(userClaims, secret);
    return Response.json({ jwt: token });
  }

  if (pathname === '/api/auth/logout' && request.method === 'POST') {
    return Response.json({ success: true });
  }

  if (pathname === '/api/auth/update-name' && request.method === 'POST') {
    const userClaims = await extractUser(request, env);
    if (!userClaims) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = await request.json() as any;
    if (!name) return Response.json({ error: 'Name is required' }, { status: 400 });

    await env.DB.prepare('UPDATE users SET name = ?, updated_at = datetime("now") WHERE email = ?')
      .bind(name.trim(), userClaims.email).run();

    return Response.json({ success: true, name: name.trim() });
  }

  if (pathname === '/api/auth/update-password' && request.method === 'POST') {
    const userClaims = await extractUser(request, env);
    if (!userClaims) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { newPassword, oldPassword } = await request.json() as any;
    if (!newPassword || !oldPassword) return Response.json({ error: 'Missing password fields' }, { status: 400 });

    const user = await env.DB.prepare('SELECT password_hash FROM users WHERE email = ?').bind(userClaims.email).first() as any;
    if (!user || !(await verifyPassword(oldPassword, user.password_hash))) {
      return Response.json({ error: 'Invalid current password' }, { status: 400 });
    }

    const newHash = await hashPassword(newPassword);
    await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE email = ?')
      .bind(newHash, userClaims.email).run();

    return Response.json({ success: true });
  }

  if (pathname === '/api/auth/update-phone' && request.method === 'POST') {
    const userClaims = await extractUser(request, env);
    if (!userClaims) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone } = await request.json() as any;
    await env.DB.prepare('UPDATE users SET phone = ?, updated_at = datetime("now") WHERE email = ?')
      .bind(phone || '', userClaims.email).run();

    return Response.json({ success: true, phone });
  }

  if ((pathname === '/api/auth/send-otp' || pathname === '/send-otp') && request.method === 'POST') {
    const { phone, code } = await request.json() as any;
    if (!phone || !code) {
      return Response.json({ error: 'Phone and OTP code are required' }, { status: 400 });
    }
    const cleanPhone = String(phone).replace(/\D/g, '');
    console.log(`[OTP] Generated and dispatching OTP ${code} to ${phone}`);

    let twilioResult: { success: boolean; sid?: string; error?: string } = { success: false };

    // 1. Send via Twilio WhatsApp if configured
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      const otpText = `🚚 *LorryGuru Fleet Tracker*\n\nYour Verification Code is: *${code}*\n\nDo not share this OTP with anyone. Valid for 10 minutes.`;
      twilioResult = await sendTwilioMessage(env, phone, otpText, true);

      // Fallback: If WhatsApp delivery returns an error, attempt direct SMS
      if (!twilioResult.success) {
        console.info(`[Twilio] WhatsApp dispatch (${twilioResult.error}), trying SMS fallback...`);
        twilioResult = await sendTwilioMessage(env, phone, `Your LorryGuru Verification OTP is: ${code}. Valid for 10 minutes.`, false);
      }
    }

    // 2. Secondary fallback: Forward to custom WhatsApp Gateway if URL configured
    let gatewaySuccess = twilioResult.success;
    if (!gatewaySuccess && (env as any).WHATSAPP_GATEWAY_URL) {
      try {
        const gwRes = await fetch((env as any).WHATSAPP_GATEWAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, code }),
        });
        if (gwRes.ok) gatewaySuccess = true;
      } catch (_) {}
    }

    return Response.json({
      success: true,
      message: `OTP sent successfully to ${phone}`,
      phone: cleanPhone,
      code,
      twilioDelivered: twilioResult.success,
      twilioSid: twilioResult.sid,
      gatewayDelivered: gatewaySuccess
    });
  }

  if ((pathname === '/api/auth/verify-user-phone' || pathname === '/verify-user-phone') && request.method === 'POST') {
    const { userId, phone } = await request.json() as any;
    if (userId) {
      await env.DB.prepare('UPDATE users SET phone_verified = 1, updated_at = datetime("now") WHERE id = ?')
        .bind(userId).run();
    } else if (phone) {
      await env.DB.prepare('UPDATE users SET phone_verified = 1, updated_at = datetime("now") WHERE phone LIKE ?')
        .bind(`%${phone}%`).run();
    }
    return Response.json({
      success: true,
      message: 'User phone verified successfully in Cloudflare D1 Auth.'
    });
  }

  if ((pathname === '/api/auth/recovery' || pathname === '/api/auth/create-recovery' || pathname === '/create-recovery') && request.method === 'POST') {
    const { email, url } = await request.json() as any;
    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await env.DB.prepare('SELECT id, name, email, phone FROM users WHERE email = ?').bind(cleanEmail).first() as any;
    if (!user) {
      return Response.json({ error: 'No account found with this email address' }, { status: 404 });
    }

    const recoverySecret = generateId('sec_') + Math.random().toString(36).substring(2, 10);
    const targetUrl = url || 'https://www.lorryguru.in/?mode=recovery';
    const separator = targetUrl.includes('?') ? '&' : '?';
    const recoveryUrl = `${targetUrl}${separator}userId=${user.id}&secret=${recoverySecret}&mode=recovery`;

    const recoveryData = {
      userId: user.id,
      email: cleanEmail,
      secret: recoverySecret,
      expiresAt: Date.now() + (60 * 60 * 1000) // 1 hour
    };

    await env.DB.prepare(`
      INSERT INTO global_configs (key, data, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
    `).bind(`recovery_${user.id}`, JSON.stringify(recoveryData)).run();

    console.log(`[Recovery] Password reset requested for ${cleanEmail}. Secret: ${recoverySecret}`);

    // If user has a phone, deliver via Twilio WhatsApp & Gateway
    if (user.phone) {
      const resetText = `🔐 *LorryGuru Password Reset*\n\nHi ${user.name || 'User'},\nYou requested to reset your password. Use the link below to set a new password:\n\n${recoveryUrl}\n\nValid for 1 hour.`;
      if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
        await sendTwilioMessage(env, user.phone, resetText, true);
      }
      const cleanPhone = String(user.phone).replace(/\D/g, '');
      const gatewayUrl = (env as any).WHATSAPP_GATEWAY_URL;
      if (gatewayUrl) {
        try {
          await fetch(gatewayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: cleanPhone,
              message: resetText
            })
          });
        } catch (_) {}
      }
    }

    return Response.json({
      success: true,
      message: `Password reset link generated and dispatched for ${cleanEmail}.`,
      recoveryUrl,
      userId: user.id,
      secret: recoverySecret
    });
  }

  if ((pathname === '/api/auth/update-recovery' || pathname === '/api/auth/reset-password' || pathname === '/reset-password') && request.method === 'POST') {
    const { userId, secret: recoverySecret, password } = await request.json() as any;
    if (!userId || !recoverySecret || !password) {
      return Response.json({ error: 'User ID, recovery secret, and new password are required' }, { status: 400 });
    }
    if (String(password).length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const recoveryRecord = await env.DB.prepare('SELECT data FROM global_configs WHERE key = ?')
      .bind(`recovery_${userId}`).first() as any;

    if (!recoveryRecord) {
      return Response.json({ error: 'Invalid or expired password reset link' }, { status: 400 });
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(recoveryRecord.data);
    } catch (_) {
      return Response.json({ error: 'Invalid recovery token payload' }, { status: 400 });
    }

    if (parsed.secret !== recoverySecret) {
      return Response.json({ error: 'Invalid recovery secret code' }, { status: 400 });
    }

    if (Date.now() > (parsed.expiresAt || 0)) {
      return Response.json({ error: 'Password reset link has expired. Please request a new one.' }, { status: 400 });
    }

    const pwdHash = await hashPassword(password);
    await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?')
      .bind(pwdHash, userId).run();

    // Invalidate recovery token
    await env.DB.prepare('DELETE FROM global_configs WHERE key = ?')
      .bind(`recovery_${userId}`).run();

    console.log(`[Recovery] Password successfully reset for user ${userId}`);

    return Response.json({
      success: true,
      message: 'Your password has been successfully reset. You can now log in.'
    });
  }


  // ── Google OAuth ─────────────────────────────────────────────────────────
  // Step 1: redirect the browser to Google's consent screen
  if (pathname === '/api/auth/google' && request.method === 'GET') {
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return Response.json({ error: 'Google OAuth is not configured on this server.' }, { status: 503 });
    }

    const baseUrl = env.APP_URL || 'https://truck-trip-tracker.apkavin483.workers.dev';
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account'
    });

    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
  }

  // Step 2: Google redirects back here with ?code=…
  if (pathname === '/api/auth/google/callback' && request.method === 'GET') {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const errorParam = url.searchParams.get('error');
    const baseUrl = env.APP_URL || 'https://truck-trip-tracker.apkavin483.workers.dev';

    if (errorParam || !code) {
      return Response.redirect(`${baseUrl}/?google_error=${encodeURIComponent(errorParam || 'no_code')}`, 302);
    }

    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return Response.redirect(`${baseUrl}/?google_error=server_not_configured`, 302);
    }

    try {
      // Exchange authorization code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${baseUrl}/api/auth/google/callback`,
          grant_type: 'authorization_code'
        })
      });

      const tokenData: any = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        console.error('[Google OAuth] Token exchange failed:', tokenData);
        return Response.redirect(`${baseUrl}/?google_error=token_exchange_failed`, 302);
      }

      // Fetch Google user profile
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const profile: any = await profileRes.json();
      if (!profile.email) {
        return Response.redirect(`${baseUrl}/?google_error=no_email_from_google`, 302);
      }

      const cleanEmail = profile.email.trim().toLowerCase();
      const displayName = profile.name || profile.given_name || cleanEmail.split('@')[0];

      // Upsert user in D1
      let existingUser = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail).first() as any;
      let userId: string;
      let orgId: string;
      let role: string;

      if (existingUser) {
        userId = existingUser.id;
        orgId = existingUser.organization_id || 'org_default';
        role = existingUser.role || 'Owner';

        await env.DB.prepare('UPDATE users SET email_verified = 1, phone_verified = 1, name = COALESCE(NULLIF(name, ""), ?), updated_at = datetime("now") WHERE id = ?')
          .bind(displayName, userId).run();
      } else {
        userId = generateId('usr_');
        orgId = `org_${generateId('')}`;
        role = 'Owner';

        await env.DB.prepare(`
          INSERT INTO users (id, email, password_hash, name, phone, organization_id, role, email_verified, phone_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
        `).bind(userId, cleanEmail, '', displayName, '', orgId, role).run();

        const customOrgName = `${displayName}'s Logistics`;
        const orgProfile = {
          organizationId: orgId,
          organizationName: customOrgName,
          ownerEmail: cleanEmail,
          ownerName: displayName,
          status: 'Active',
          truckRequests: []
        };
        await env.DB.prepare(`
          INSERT INTO global_configs (key, data, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
        `).bind(`prf_${orgId}`, JSON.stringify(orgProfile)).run();
      }

      // Sync into global_configs for permission lookups
      const userDocId = getEmailDocId(cleanEmail);
      const userConfigData = {
        id: userId,
        email: cleanEmail,
        name: displayName,
        phone: existingUser?.phone || '',
        role,
        organizationId: orgId,
        isEmailVerified: true,
        isPhoneVerified: true,
        permissions: ['read', 'write']
      };
      await env.DB.prepare(`
        INSERT INTO global_configs (key, data, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
      `).bind(userDocId, JSON.stringify(userConfigData)).run();

      console.log(`[Google OAuth] Authenticated user: ${cleanEmail} (org ${orgId})`);

      // Check global_configs for any overridden org/role from admin rights panel
      try {
        const cfgDoc = await env.DB.prepare('SELECT data FROM global_configs WHERE key = ?')
          .bind(getEmailDocId(cleanEmail)).first() as any;
        if (cfgDoc?.data) {
          const parsed = JSON.parse(cfgDoc.data);
          if (parsed.organizationId) orgId = parsed.organizationId;
          if (parsed.role) role = parsed.role;
        }
      } catch (_) {}

      // Issue JWT
      const jwt = await createJWT({
        userId,
        email: cleanEmail,
        name: displayName,
        role,
        organizationId: orgId,
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600) // 30 days
      }, secret);

      // Redirect back to app with JWT in query param (frontend will pick it up and store in localStorage)
      return Response.redirect(
        `${baseUrl}/?google_jwt=${encodeURIComponent(jwt)}&google_email=${encodeURIComponent(cleanEmail)}&google_name=${encodeURIComponent(displayName)}&google_org=${encodeURIComponent(orgId)}&google_role=${encodeURIComponent(role)}`,
        302
      );
    } catch (err: any) {
      console.error('[Google OAuth] Callback error:', err);
      return Response.redirect(`${baseUrl}/?google_error=internal_error`, 302);
    }
  }

  // Step 3: Direct Google ID Token Authentication from GIS Frontend Popup
  if (pathname === '/api/auth/google-token' && request.method === 'POST') {
    const { credential, orgName: requestedOrgName } = await request.json() as any;
    if (!credential) {
      return Response.json({ error: 'Google credential token is required' }, { status: 400 });
    }

    try {
      // Verify token with Google's public tokeninfo endpoint
      const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!verifyRes.ok) {
        return Response.json({ error: 'Invalid Google credential token' }, { status: 401 });
      }

      const payload: any = await verifyRes.json();
      if (!payload.email) {
        return Response.json({ error: 'Google account has no verified email' }, { status: 400 });
      }

      const cleanEmail = payload.email.trim().toLowerCase();
      const displayName = payload.name || payload.given_name || cleanEmail.split('@')[0];

      // Check if user exists in D1
      let existingUser = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail).first() as any;
      let userId: string;
      let orgId: string;
      let role: string;

      if (existingUser) {
        userId = existingUser.id;
        orgId = existingUser.organization_id || 'org_default';
        role = existingUser.role || 'Owner';

        await env.DB.prepare('UPDATE users SET email_verified = 1, phone_verified = 1, name = COALESCE(NULLIF(name, ""), ?), updated_at = datetime("now") WHERE id = ?')
          .bind(displayName, userId).run();
      } else {
        userId = generateId('usr_');
        orgId = `org_${generateId('')}`;
        role = 'Owner';

        await env.DB.prepare(`
          INSERT INTO users (id, email, password_hash, name, phone, organization_id, role, email_verified, phone_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
        `).bind(userId, cleanEmail, '', displayName, '', orgId, role).run();

        const customOrgName = (requestedOrgName && requestedOrgName.trim()) || `${displayName}'s Logistics`;
        const orgProfile = {
          organizationId: orgId,
          organizationName: customOrgName,
          ownerEmail: cleanEmail,
          ownerName: displayName,
          status: 'Active',
          truckRequests: []
        };
        await env.DB.prepare(`
          INSERT INTO global_configs (key, data, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
        `).bind(`prf_${orgId}`, JSON.stringify(orgProfile)).run();
      }

      // Sync into global_configs for permission lookups
      const userDocId = getEmailDocId(cleanEmail);
      const userConfigData = {
        id: userId,
        email: cleanEmail,
        name: displayName,
        phone: existingUser?.phone || '',
        role,
        organizationId: orgId,
        isEmailVerified: true,
        isPhoneVerified: true,
        permissions: ['read', 'write']
      };
      await env.DB.prepare(`
        INSERT INTO global_configs (key, data, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = datetime('now')
      `).bind(userDocId, JSON.stringify(userConfigData)).run();

      try {
        const cfgDoc = await env.DB.prepare('SELECT data FROM global_configs WHERE key = ?')
          .bind(getEmailDocId(cleanEmail)).first() as any;
        if (cfgDoc?.data) {
          const parsed = JSON.parse(cfgDoc.data);
          if (parsed.organizationId) orgId = parsed.organizationId;
          if (parsed.role) role = parsed.role;
        }
      } catch (_) {}

      const token = await createJWT({
        userId,
        email: cleanEmail,
        name: displayName,
        role,
        organizationId: orgId,
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 3600)
      }, secret);

      return Response.json({
        success: true,
        user: {
          $id: userId,
          id: userId,
          name: displayName,
          email: cleanEmail,
          phone: '',
          emailVerification: true,
          phoneVerification: false,
          organizationId: orgId,
          role
        },
        jwt: token
      });
    } catch (err: any) {
      console.error('[Google Token Auth Error]:', err);
      return Response.json({ error: 'Failed to authenticate Google token: ' + (err.message || err) }, { status: 500 });
    }
  }

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
