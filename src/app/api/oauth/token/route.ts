import { NextRequest, NextResponse } from 'next/server';
import { getAppByClientId, getUserProfile } from '@/lib/services/firestore-service';
import { 
  createSSOAccessToken, 
  createSSOIdToken, 
  verifyAuthorizationCode, 
  AuthCodeData 
} from '@/lib/auth/jwt';
import { consumeStoredAuthCode } from '../authorize/route';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, string> = {};
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      formData.forEach((val, key) => {
        body[key] = val.toString();
      });
    }

    let { grant_type, code, client_id, client_secret, redirect_uri } = body;

    // Check HTTP Basic Auth header: Authorization: Basic <base64(client_id:client_secret)>
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Basic ')) {
      try {
        const credentials = atob(authHeader.substring(6));
        const [basicId, basicSecret] = credentials.split(':');
        if (basicId && !client_id) client_id = basicId;
        if (basicSecret && !client_secret) client_secret = basicSecret;
      } catch (err) {
        console.warn('Failed to parse Basic Auth header:', err);
      }
    }

    if (!client_id || !code) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'client_id and code are required' },
        { status: 400 }
      );
    }

    // Verify registered client app in Firestore
    const app = await getAppByClientId(client_id);
    if (!app) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Registered app not found or inactive' },
        { status: 401 }
      );
    }

    // Validate client secret if provided
    if (client_secret && app.clientSecret !== client_secret) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client_secret' },
        { status: 401 }
      );
    }

    let authData: AuthCodeData | null = null;

    // 1. Interactive Playground / Docs Simulation code support
    if (code.startsWith('sso_code_simulation_')) {
      authData = {
        clientId: client_id,
        userId: 'usr_simulation_demo',
        userEmail: 'demo@ten.my.id',
        userName: 'Developer Demo User',
        userRole: 'Member',
        redirectUri: redirect_uri || 'https://finance.ten.my.id/oauth/callback',
      };
    }

    // 2. Stateless cryptographically signed authorization code (Edge / Serverless runtime)
    if (!authData) {
      authData = await verifyAuthorizationCode(code, client_id);
    }

    // 3. Fallback to in-memory codeStore (for same-isolate requests)
    if (!authData) {
      const storedCode = consumeStoredAuthCode(code);
      if (storedCode && storedCode.clientId === client_id) {
        authData = {
          clientId: storedCode.clientId,
          userId: storedCode.userId,
          userEmail: storedCode.userEmail,
          userName: storedCode.userName,
          userRole: storedCode.userRole,
          redirectUri: storedCode.redirectUri,
        };
      }
    }

    if (!authData) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Authorization code is invalid or has expired' },
        { status: 400 }
      );
    }

    const uid = authData.userId;
    const email = authData.userEmail;
    const role = authData.userRole;

    // Fetch freshest user profile details
    const userProfile = await getUserProfile(uid);
    const displayName = userProfile?.displayName || authData.userName || 'User';
    const username = userProfile?.username || email.split('@')[0] || uid;

    const tokenPayload = {
      uid,
      sub: uid,
      email,
      displayName,
      username,
      role: userProfile?.role || role,
      clientId: client_id,
      scope: 'openid profile email',
    };

    // Generate JWT Access Token and OpenID Connect ID Token
    const [accessToken, idToken] = await Promise.all([
      createSSOAccessToken(tokenPayload, '24h'),
      createSSOIdToken(tokenPayload, '24h'),
    ]);

    return NextResponse.json({
      access_token: accessToken,
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours
      scope: 'openid profile email',
      user: {
        sub: uid,
        uid,
        email,
        displayName,
        username,
        role: userProfile?.role || role,
        status: userProfile?.status || 'active',
        company: userProfile?.company || '',
        title: userProfile?.title || '',
      }
    });
  } catch (error) {
    console.error('OAuth token exchange error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal SSO token exchange failure' },
      { status: 500 }
    );
  }
}
