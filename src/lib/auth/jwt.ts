import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.SSO_JWT_SECRET || 'super-secure-sso-jwt-secret-key-ten-my-id-min-32-chars-length'
);

export interface SSOTokenPayload {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  clientId: string;
  scope?: string;
  [key: string]: unknown;
}

export async function createSSOAccessToken(payload: SSOTokenPayload, expiresIn: string = '24h'): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('https://account.ten.my.id')
    .setAudience(payload.clientId)
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function verifySSOAccessToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: 'https://account.ten.my.id',
    });
    return payload as unknown as SSOTokenPayload;
  } catch (error) {
    console.error('SSO Token verification failed:', error);
    return null;
  }
}
