import { getFirebaseApp, getFirebaseDb, setFirebaseDb, isFirebaseConfigured } from '@/lib/firebase/client';
import type { Firestore } from 'firebase/firestore';
import { 
  SSOUser, 
  SSORole, 
  SSOPermission, 
  RegisteredApp, 
  SSOSettings, 
  SSOAuditLog 
} from '@/types/sso';

// In-Memory & LocalStorage Cache fallback for zero-config offline or dev testing
const LOCAL_STORAGE_KEY_PREFIX = 'sso_ten_';

// Helper to remove undefined properties before sending to Firestore
function cleanData<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }
  return clean;
}

let _cachedDb: Firestore | null = null;

// Lazy loader for Firestore to ensure zero eval/codegen errors in Cloudflare Workers workerd runtime
async function getFirestoreModule() {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) {
    return null;
  }
  try {
    const fs = await import('firebase/firestore');
    if (!_cachedDb) {
      const app = getFirebaseApp();
      try {
        _cachedDb = fs.initializeFirestore(app, {
          ignoreUndefinedProperties: true,
        });
      } catch {
        _cachedDb = fs.getFirestore(app);
      }
      setFirebaseDb(_cachedDb);
    }
    return { fs, db: _cachedDb };
  } catch (err) {
    console.error('[SSO Firestore] Failed to initialize Firestore module:', err);
    return null;
  }
}

const defaultPermissions: SSOPermission[] = [
  { id: 'perm-1', key: 'users.read', name: 'View Users', category: 'users', description: 'Can view list of users and profiles' },
  { id: 'perm-2', key: 'users.write', name: 'Manage Users', category: 'users', description: 'Can create, edit, suspend, and delete users' },
  { id: 'perm-3', key: 'roles.manage', name: 'Manage Roles', category: 'roles', description: 'Can create and assign roles and permissions' },
  { id: 'perm-4', key: 'apps.manage', name: 'Manage OAuth Apps', category: 'apps', description: 'Can register, modify, and revoke client applications' },
  { id: 'perm-5', key: 'sso.authorize', name: 'Authorize SSO', category: 'sso', description: 'Can perform single sign-on authorization to connected apps' },
  { id: 'perm-6', key: 'settings.manage', name: 'System Settings', category: 'settings', description: 'Can modify global SSO and security parameters' },
  { id: 'perm-7', key: 'audit.read', name: 'View Audit Logs', category: 'audit', description: 'Can view security and authentication audit trail' },
];

const defaultRoles: SSORole[] = [
  {
    id: 'role-superadmin',
    name: 'Superadmin',
    description: 'Full administrative access across all SSO modules and clients',
    permissions: ['users.read', 'users.write', 'roles.manage', 'apps.manage', 'sso.authorize', 'settings.manage', 'audit.read'],
    isSystemRole: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Administrative access to manage users, apps, and view logs',
    permissions: ['users.read', 'users.write', 'apps.manage', 'sso.authorize', 'audit.read'],
    isSystemRole: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'role-member',
    name: 'Member',
    description: 'Standard account access with SSO authorization rights to designated apps',
    permissions: ['sso.authorize'],
    isSystemRole: true,
    createdAt: new Date().toISOString(),
  },
];

const defaultApps: RegisteredApp[] = [
  {
    id: 'app-workspace',
    name: 'WorkSpace TEN',
    description: 'Core digital workplace & project collaboration platform',
    clientId: 'ten_ws_893427189a',
    clientSecret: 'sec_live_98ab78c61e47a250fa9e7b1c3d',
    redirectUris: ['https://workspace.ten.my.id/auth/callback', 'http://localhost:3001/auth/callback'],
    logoUrl: '',
    isActive: true,
    allowedScopes: ['openid', 'profile', 'email', 'roles'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'app-finance',
    name: 'Automasi & Digitalisasi Hub',
    description: 'Internal automation and reporting system',
    clientId: 'ten_hub_391058204b',
    clientSecret: 'sec_live_55bc81f33a102e99d8b76c2e1a',
    redirectUris: ['https://hub.ten.my.id/sso/callback', 'http://localhost:3002/sso/callback'],
    logoUrl: '',
    isActive: true,
    allowedScopes: ['openid', 'profile', 'email'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'app-docs',
    name: 'Knowledge & Docs Portal',
    description: 'Central documentation and institutional wiki',
    clientId: 'ten_docs_192837465c',
    clientSecret: 'sec_live_11fa23d88c991e44f7a65b0c9e',
    redirectUris: ['https://docs.ten.my.id/login/oauth/callback'],
    logoUrl: '',
    isActive: true,
    allowedScopes: ['openid', 'profile', 'email'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'app-community',
    name: 'Komunitas & Relawan TEN',
    description: 'Volunteer & community membership portal',
    clientId: 'ten_community_847192038d',
    clientSecret: 'sec_live_44ef91a27b880c55d9e33f2a1b',
    redirectUris: ['https://komunitas.ten.my.id/auth/sso/callback'],
    logoUrl: '',
    isActive: true,
    allowedScopes: ['openid', 'profile', 'email'],
    createdAt: new Date().toISOString(),
  }
];

const defaultSettings: SSOSettings = {
  appName: 'TEN Single Sign-On',
  companyName: 'TEN-MY-ID',
  supportEmail: 'support@ten.my.id',
  allowRegistration: true,
  requireEmailVerification: false,
  sessionTimeoutHours: 72,
  defaultRoleId: 'role-member',
  allowedRedirectDomains: ['ten.my.id', 'localhost'],
  updatedAt: new Date().toISOString(),
};

// Storage helper for browser local fallback
function getLocalItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.error('LocalStorage write error:', err);
  }
}

// ----------------------------------------------------
// USER REPOSITORY
// ----------------------------------------------------
export async function getUserProfile(identifier: string): Promise<SSOUser | null> {
  const decoded = decodeURIComponent(identifier || '');
  const clean = decoded.replace(/^@/, '').toLowerCase().trim();

  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      // First try by direct document ID (uid)
      const userRef = fs.doc(db, 'users', decoded);
      const snap = await fs.getDoc(userRef);
      if (snap.exists()) {
        return snap.data() as SSOUser;
      }

      // Try by username query
      const q = fs.query(fs.collection(db, 'users'), fs.where('username', '==', clean), fs.limit(1));
      const querySnap = await fs.getDocs(q);
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as SSOUser;
      }
    } catch (e) {
      console.error('[SSO Firestore] getUserProfile failed:', e);
    }

    if (isFirebaseConfigured()) {
      return null;
    }
  }

  // Offline development fallback only when Firebase is NOT configured
  if (!isFirebaseConfigured()) {
    const users = getLocalItem<SSOUser[]>('users', []);
    return (
      users.find(
        (u) => u.uid === decoded || (u.username && u.username.toLowerCase() === clean)
      ) || null
    );
  }

  return null;
}

export async function isUsernameAvailable(username: string, excludeUid?: string): Promise<boolean> {
  const clean = username.replace(/^@/, '').toLowerCase().trim();

  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      const q = fs.query(fs.collection(db, 'users'), fs.where('username', '==', clean), fs.limit(2));
      const querySnap = await fs.getDocs(q);
      if (querySnap.empty) return true;
      const matches = querySnap.docs.map(d => d.data() as SSOUser);
      return matches.every(u => u.uid === excludeUid);
    } catch (e) {
      console.error('[SSO Firestore] isUsernameAvailable failed:', e);
    }

    if (isFirebaseConfigured()) {
      return true;
    }
  }

  const users = getLocalItem<SSOUser[]>('users', []);
  const existing = users.find(
    (u) => u.username && u.username.toLowerCase() === clean && u.uid !== excludeUid
  );
  return !existing;
}

export async function saveUserProfile(user: SSOUser): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      const userRef = fs.doc(db, 'users', user.uid);
      const dataToSave = cleanData({
        ...user,
        updatedAt: new Date().toISOString(),
      });
      await fs.setDoc(userRef, dataToSave, { merge: true });
      return;
    } catch (e) {
      console.error('[SSO Firestore] saveUserProfile failed, falling back to local store:', e);
    }
  }

  const users = getLocalItem<SSOUser[]>('users', []);
  const idx = users.findIndex((u) => u.uid === user.uid);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user, updatedAt: new Date().toISOString() };
  } else {
    users.push(user);
  }
  setLocalItem('users', users);
}

export async function listAllUsers(): Promise<SSOUser[]> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      const snap = await fs.getDocs(fs.collection(db, 'users'));
      return snap.docs.map(d => d.data() as SSOUser);
    } catch (e) {
      console.error('[SSO Firestore] listAllUsers failed:', e);
      return [];
    }
  }

  // If Firebase is configured, strictly do NOT return dummy users
  if (isFirebaseConfigured()) {
    return [];
  }

  return getLocalItem<SSOUser[]>('users', []);
}

export async function deleteUserProfile(uid: string): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.deleteDoc(fs.doc(db, 'users', uid));
      return;
    } catch (e) {
      console.error('[SSO Firestore] deleteUserProfile failed:', e);
    }
  }

  const users = getLocalItem<SSOUser[]>('users', []);
  const filtered = users.filter(u => u.uid !== uid);
  setLocalItem('users', filtered);
}

export const listRoles = getRoles;
export const listPermissions = getPermissions;

export async function updateUserRole(uid: string, roleName: string, roleId: string): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.updateDoc(fs.doc(db, 'users', uid), {
        role: roleName,
        roleId: roleId,
        updatedAt: new Date().toISOString()
      });
      return;
    } catch (e) {
      console.warn('Firestore updateUserRole fallback', e);
    }
  }

  const users = await listAllUsers();
  const idx = users.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    users[idx].role = roleName;
    users[idx].roleId = roleId;
    setLocalItem('users', users);
  }
}

export async function updateUserStatus(uid: string, status: 'active' | 'suspended' | 'pending'): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.updateDoc(fs.doc(db, 'users', uid), {
        status,
        updatedAt: new Date().toISOString()
      });
      return;
    } catch (e) {
      console.warn('Firestore updateUserStatus fallback', e);
    }
  }

  const users = await listAllUsers();
  const idx = users.findIndex(u => u.uid === uid);
  if (idx >= 0) {
    users[idx].status = status;
    setLocalItem('users', users);
  }
}

// ----------------------------------------------------
// ROLES & PERMISSIONS REPOSITORY
// ----------------------------------------------------
export async function getRoles(): Promise<SSORole[]> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      const snap = await fs.getDocs(fs.collection(db, 'roles'));
      if (!snap.empty) {
        return snap.docs.map(d => d.data() as SSORole);
      }
    } catch (e) {
      console.warn('Firestore getRoles fallback', e);
    }
  }

  const roles = getLocalItem<SSORole[]>('roles', defaultRoles);
  setLocalItem('roles', roles);
  return roles;
}

export async function saveRole(role: SSORole): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.setDoc(fs.doc(db, 'roles', role.id), cleanData(role as unknown as Record<string, unknown>), { merge: true });
      return;
    } catch (e) {
      console.error('[SSO Firestore] saveRole failed, fallback to local store:', e);
    }
  }

  const roles = getLocalItem<SSORole[]>('roles', defaultRoles);
  const idx = roles.findIndex(r => r.id === role.id);
  if (idx >= 0) {
    roles[idx] = role;
  } else {
    roles.push(role);
  }
  setLocalItem('roles', roles);
}

export async function deleteRole(roleId: string): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.deleteDoc(fs.doc(db, 'roles', roleId));
      return;
    } catch (e) {
      console.warn('Firestore deleteRole fallback', e);
    }
  }

  const roles = getLocalItem<SSORole[]>('roles', defaultRoles).filter(r => r.id !== roleId);
  setLocalItem('roles', roles);
}

export async function getPermissions(): Promise<SSOPermission[]> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      const snap = await fs.getDocs(fs.collection(db, 'permissions'));
      if (!snap.empty) {
        return snap.docs.map(d => d.data() as SSOPermission);
      }
    } catch (e) {
      console.warn('Firestore getPermissions fallback', e);
    }
  }

  const perms = getLocalItem<SSOPermission[]>('permissions', defaultPermissions);
  setLocalItem('permissions', perms);
  return perms;
}

export async function savePermission(perm: SSOPermission): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.setDoc(fs.doc(db, 'permissions', perm.id), cleanData(perm as unknown as Record<string, unknown>), { merge: true });
      return;
    } catch (e) {
      console.error('[SSO Firestore] savePermission failed, fallback to local store:', e);
    }
  }

  const perms = getLocalItem<SSOPermission[]>('permissions', defaultPermissions);
  const idx = perms.findIndex(p => p.id === perm.id);
  if (idx >= 0) {
    perms[idx] = perm;
  } else {
    perms.push(perm);
  }
  setLocalItem('permissions', perms);
}

export async function deletePermission(permId: string): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.deleteDoc(fs.doc(db, 'permissions', permId));
      return;
    } catch (e) {
      console.error('[SSO Firestore] deletePermission fallback:', e);
    }
  }

  const perms = getLocalItem<SSOPermission[]>('permissions', defaultPermissions).filter(p => p.id !== permId);
  setLocalItem('permissions', perms);
}

// ----------------------------------------------------
// REGISTERED OAUTH APPS REPOSITORY
// ----------------------------------------------------
export async function listRegisteredApps(): Promise<RegisteredApp[]> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      const snap = await fs.getDocs(fs.collection(db, 'apps'));
      return snap.docs.map(d => d.data() as RegisteredApp);
    } catch (e) {
      console.error('[SSO Firestore] listRegisteredApps error:', e);
      if (isFirebaseConfigured()) {
        return [];
      }
    }
  }

  if (isFirebaseConfigured()) {
    return [];
  }

  const apps = getLocalItem<RegisteredApp[]>('apps', defaultApps);
  return apps;
}

export async function getAppByClientId(clientId: string): Promise<RegisteredApp | null> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      const q = fs.query(fs.collection(db, 'apps'), fs.where('clientId', '==', clientId), fs.limit(1));
      const snap = await fs.getDocs(q);
      if (!snap.empty) {
        const app = snap.docs[0].data() as RegisteredApp;
        return app.isActive ? app : null;
      }
    } catch (e) {
      console.error('[SSO Firestore] getAppByClientId error:', e);
    }
    if (isFirebaseConfigured()) {
      return null;
    }
  }

  const apps = await listRegisteredApps();
  return apps.find(a => a.clientId === clientId && a.isActive) || null;
}

export async function saveRegisteredApp(appData: RegisteredApp): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.setDoc(fs.doc(db, 'apps', appData.id), cleanData(appData as unknown as Record<string, unknown>), { merge: true });
      return;
    } catch (e) {
      console.error('[SSO Firestore] saveRegisteredApp failed, fallback to local store:', e);
    }
  }

  const apps = getLocalItem<RegisteredApp[]>('apps', defaultApps);
  const idx = apps.findIndex(a => a.id === appData.id);
  if (idx >= 0) {
    apps[idx] = { ...apps[idx], ...appData, updatedAt: new Date().toISOString() };
  } else {
    apps.push(appData);
  }
  setLocalItem('apps', apps);
}

export async function deleteRegisteredApp(appId: string): Promise<void> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.deleteDoc(fs.doc(db, 'apps', appId));
      return;
    } catch (e) {
      console.warn('Firestore deleteRegisteredApp fallback', e);
    }
  }

  const apps = getLocalItem<RegisteredApp[]>('apps', defaultApps).filter(a => a.id !== appId);
  setLocalItem('apps', apps);
}

// ----------------------------------------------------
// SETTINGS REPOSITORY
// ----------------------------------------------------
export async function getSSOSettings(): Promise<SSOSettings> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      const snap = await fs.getDoc(fs.doc(db, 'settings', 'sso'));
      if (snap.exists()) {
        return snap.data() as SSOSettings;
      }
    } catch (e) {
      console.warn('Firestore getSSOSettings fallback', e);
    }
  }

  const settings = getLocalItem<SSOSettings>('settings', defaultSettings);
  setLocalItem('settings', settings);
  return settings;
}

export async function saveSSOSettings(settings: SSOSettings): Promise<void> {
  const updated = { ...settings, updatedAt: new Date().toISOString() };
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.setDoc(fs.doc(db, 'settings', 'sso'), cleanData(updated as unknown as Record<string, unknown>), { merge: true });
      return;
    } catch (e) {
      console.error('[SSO Firestore] saveSSOSettings failed, fallback to local store:', e);
    }
  }

  setLocalItem('settings', updated);
}

// ----------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------
export async function logSSOEvent(
  action: SSOAuditLog['action'], 
  userEmail: string, 
  detail: string, 
  userId: string = 'system'
): Promise<void> {
  const logItem: SSOAuditLog = {
    id: 'log_' + Math.random().toString(36).substring(2, 9),
    userId,
    userEmail,
    action,
    detail,
    timestamp: new Date().toISOString(),
  };

  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      await fs.setDoc(fs.doc(db, 'audit_logs', logItem.id), cleanData(logItem as unknown as Record<string, unknown>));
    } catch (e) {
      console.error('[SSO Firestore] logSSOEvent failed, fallback to local store:', e);
    }
  }

  const logs = getLocalItem<SSOAuditLog[]>('audit_logs', []);
  logs.unshift(logItem);
  if (logs.length > 100) logs.pop();
  setLocalItem('audit_logs', logs);
}

export async function getRecentAuditLogs(count: number = 20): Promise<SSOAuditLog[]> {
  const f = await getFirestoreModule();
  if (f) {
    try {
      const { fs, db } = f;
      const q = fs.query(fs.collection(db, 'audit_logs'), fs.orderBy('timestamp', 'desc'), fs.limit(count));
      const snap = await fs.getDocs(q);
      return snap.docs.map(d => d.data() as SSOAuditLog);
    } catch (e) {
      console.error('[SSO Firestore] getRecentAuditLogs error:', e);
      if (isFirebaseConfigured()) {
        return [];
      }
    }
  }

  if (isFirebaseConfigured()) {
    return [];
  }

  const logs = getLocalItem<SSOAuditLog[]>('audit_logs', []);
  return logs.slice(0, count);
}
