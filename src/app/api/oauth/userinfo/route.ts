import { NextRequest, NextResponse } from 'next/server';
import { verifySSOAccessToken } from '@/lib/auth/jwt';
import { getUserProfile } from '@/lib/services/firestore-service';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'unauthorized', error_description: 'Bearer token is missing or malformed' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);
  const payload = await verifySSOAccessToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'The access token is invalid or expired' },
      { status: 401 }
    );
  }

  // Fetch full user details from Firestore service
  const userProfile = await getUserProfile(payload.uid);

  return NextResponse.json({
    sub: payload.uid,
    uid: payload.uid,
    username: userProfile?.username || payload.displayName.toLowerCase().replace(/\s+/g, '_'),
    email: payload.email,
    displayName: userProfile?.displayName || payload.displayName,
    role: userProfile?.role || payload.role,
    status: userProfile?.status || 'active',
    company: userProfile?.company || '',
    title: userProfile?.title || '',
    emailVerified: userProfile?.emailVerified ?? true,
    aud: payload.clientId,
  });
}
