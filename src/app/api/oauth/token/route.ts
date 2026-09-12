import { NextRequest, NextResponse } from 'next/server';
import { getAppByClientId } from '@/lib/services/firestore-service';
import { createSSOAccessToken } from '@/lib/auth/jwt';
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

    const { grant_type, code, client_id, client_secret, redirect_uri } = body;

    if (!client_id || !code) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'client_id and code are required' },
        { status: 400 }
      );
    }

    // Verify registered client app
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

    // Verify code
    const storedCode = consumeStoredAuthCode(code);
    if (!storedCode) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Authorization code is invalid or has expired' },
        { status: 400 }
      );
    }

    const uid = storedCode.userId;
    const email = storedCode.userEmail;
    const displayName = storedCode.userName;
    const role = storedCode.userRole;

    // Generate JWT Access Token
    const accessToken = await createSSOAccessToken({
      uid,
      email,
      displayName,
      role,
      clientId: client_id,
      scope: 'openid profile email',
    });

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours
      scope: 'openid profile email',
      user: {
        uid,
        email,
        displayName,
        role,
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
