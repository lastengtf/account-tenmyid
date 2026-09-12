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

export interface AuthCodeData {
  clientId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  redirectUri: string;
}

/**
 * Creates a cryptographically signed, stateless Authorization Code (RFC 6749)
 * Valid across all serverless isolates/workers without needing in-memory state.
 */
export async function createAuthorizationCode(data: AuthCodeData): Promise<string> {
  return new SignJWT({
    type: 'auth_code',
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName,
    userRole: data.userRole,
    redirectUri: data.redirectUri,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('https://account.ten.my.id')
    .setAudience(data.clientId)
    .setExpirationTime('10m') // 10 minutes validity
    .sign(JWT_SECRET);
}

/**
 * Verifies a stateless Authorization Code
 */
export async function verifyAuthorizationCode(code: string, expectedClientId: string): Promise<AuthCodeData | null> {
  try {
    const { payload } = await jwtVerify(code, JWT_SECRET, {
      issuer: 'https://account.ten.my.id',
      audience: expectedClientId,
    });

    if (payload.type !== 'auth_code') return null;

    return {
      clientId: (payload.aud as string) || expectedClientId,
      userId: payload.userId as string,
      userEmail: payload.userEmail as string,
      userName: payload.userName as string,
      userRole: payload.userRole as string,
      redirectUri: payload.redirectUri as string,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Creates a signed JWT Access Token
 */
export async function createSSOAccessToken(payload: SSOTokenPayload, expiresIn: string = '24h'): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('https://account.ten.my.id')
    .setAudience(payload.clientId)
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

/**
 * Creates an OpenID Connect (OIDC) ID Token
 */
export async function createSSOIdToken(payload: SSOTokenPayload, expiresIn: string = '24h'): Promise<string> {
  return new SignJWT({
    sub: payload.uid,
    uid: payload.uid,
    email: payload.email,
    name: payload.displayName,
    displayName: payload.displayName,
    preferred_username: (payload.username as string) || payload.email.split('@')[0],
    role: payload.role,
    email_verified: true,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('https://account.ten.my.id')
    .setAudience(payload.clientId)
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

/**
 * Verifies an SSO JWT token (Access Token or ID Token)
 */
export async function verifySSOAccessToken(token: string): Promise<SSOTokenPayload | null> {
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
