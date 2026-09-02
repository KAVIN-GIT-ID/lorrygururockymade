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
    console.log(`[OTP] Generated and dispatched OTP ${code} to ${cleanPhone}`);

    // Forward to WhatsApp Gateway if URL is provided
    const gatewayUrl = (env as any).WHATSAPP_GATEWAY_URL || 'http://localhost:8000/send-otp';
    const apiKey = (env as any).GATEWAY_API_KEY || 'your-super-secure-shared-key';
    let gatewaySuccess = false;

    try {
      const gwRes = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, phone: cleanPhone, code }),
      });
      if (gwRes.ok) gatewaySuccess = true;
    } catch (_) {}

    return Response.json({
      success: true,
      message: `OTP sent successfully to ${phone}`,
      phone: cleanPhone,
      code,
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

  return Response.json({ error: 'Endpoint not found' }, { status: 404 });
}
