import { db, isFirebaseConfigured } from '@/lib/firebase/client';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  where,
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  SSOUser, 
  SSORole, 
  SSOPermission, 
  RegisteredApp, 
  SSOSettings, 
  SSOAuditLog,
  AuthorizationCode 
} from '@/types/sso';

// In-Memory & LocalStorage Cache fallback for zero-config offline or dev testing
const LOCAL_STORAGE_KEY_PREFIX = 'sso_ten_';

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

  if (isFirebaseConfigured()) {
    try {
      // First try by direct document ID (uid)
      const userRef = doc(db, 'users', decoded);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return snap.data() as SSOUser;
      }

      // Try by username query
      const q = query(collection(db, 'users'), where('username', '==', clean), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as SSOUser;
      }
    } catch (e) {
      console.warn('Firestore getUserProfile direct lookup failed, fallback to all users', e);
    }
  }

  // Check all users for match by UID or username
  const users = await listAllUsers();
  return (
    users.find(
      (u) => u.uid === decoded || (u.username && u.username.toLowerCase() === clean)
    ) || null
  );
}

export async function isUsernameAvailable(username: string, excludeUid?: string): Promise<boolean> {
  const clean = username.replace(/^@/, '').toLowerCase().trim();
  const users = await listAllUsers();
  const existing = users.find(
    (u) => u.username && u.username.toLowerCase() === clean && u.uid !== excludeUid
  );
  return !existing;
}

export async function saveUserProfile(user: SSOUser): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        ...user,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return;
    } catch (e) {
      console.warn('Firestore saveUserProfile failed, falling back to local store', e);
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
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        return snap.docs.map(d => d.data() as SSOUser);
      }
    } catch (e) {
      console.warn('Firestore listAllUsers failed, falling back to local store', e);
    }
  }

  let users = getLocalItem<SSOUser[]>('users', []);
  if (users.length === 0 || !users[0]?.username) {
    // Seed default admin user for initial view with unique usernames
    const initialAdmin: SSOUser = {
      uid: 'usr_admin_root',
      username: 'admin',
      email: 'admin@ten.my.id',
      displayName: 'Administrator TEN',
      role: 'Superadmin',
      status: 'active',
      emailVerified: true,
      company: 'TEN-MY-ID Non-Profit',
      title: 'Head of Infrastructure',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    const initialMember: SSOUser = {
      uid: 'usr_demo_user',
      username: 'ahmad',
      email: 'user@ten.my.id',
      displayName: 'Ahmad Ten',
      role: 'Member',
      status: 'active',
      emailVerified: true,
      company: 'TEN Community',
      title: 'Digital Contributor',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    users = [initialAdmin, initialMember];
    setLocalItem('users', users);
  }
  return users;
}

export async function deleteUserProfile(uid: string): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await deleteDoc(doc(db, 'users', uid));
      return;
    } catch (e) {
      console.warn('Firestore deleteUserProfile fallback', e);
    }
  }

  const users = getLocalItem<SSOUser[]>('users', []).filter((u) => u.uid !== uid);
  setLocalItem('users', users);
}

// ----------------------------------------------------
// ROLES & PERMISSIONS
// ----------------------------------------------------
export async function listRoles(): Promise<SSORole[]> {
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(collection(db, 'roles'));
      if (!snap.empty) {
        return snap.docs.map(d => d.data() as SSORole);
      }
    } catch (e) {
      console.warn('Firestore listRoles fallback', e);
    }
  }

  const roles = getLocalItem<SSORole[]>('roles', defaultRoles);
  setLocalItem('roles', roles);
  return roles;
}

export async function saveRole(role: SSORole): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'roles', role.id), role, { merge: true });
      return;
    } catch (e) {
      console.warn('Firestore saveRole fallback', e);
    }
  }

  const roles = getLocalItem<SSORole[]>('roles', defaultRoles);
  const idx = roles.findIndex(r => r.id === role.id);
  if (idx >= 0) {
    roles[idx] = { ...roles[idx], ...role, updatedAt: new Date().toISOString() };
  } else {
    roles.push(role);
  }
  setLocalItem('roles', roles);
}

export async function deleteRole(roleId: string): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await deleteDoc(doc(db, 'roles', roleId));
      return;
    } catch (e) {
      console.warn('Firestore deleteRole fallback', e);
    }
  }

  const roles = getLocalItem<SSORole[]>('roles', defaultRoles).filter(r => r.id !== roleId);
  setLocalItem('roles', roles);
}

export async function listPermissions(): Promise<SSOPermission[]> {
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(collection(db, 'permissions'));
      if (!snap.empty) {
        return snap.docs.map(d => d.data() as SSOPermission);
      }
    } catch (e) {
      console.warn('Firestore listPermissions fallback', e);
    }
  }

  const perms = getLocalItem<SSOPermission[]>('permissions', defaultPermissions);
  setLocalItem('permissions', perms);
  return perms;
}

export async function savePermission(perm: SSOPermission): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'permissions', perm.id), perm, { merge: true });
      return;
    } catch (e) {
      console.warn('Firestore savePermission fallback', e);
    }
  }

  const perms = getLocalItem<SSOPermission[]>('permissions', defaultPermissions);
  const idx = perms.findIndex(p => p.id === perm.id);
  if (idx >= 0) perms[idx] = perm;
  else perms.push(perm);
  setLocalItem('permissions', perms);
}

export async function deletePermission(permId: string): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await deleteDoc(doc(db, 'permissions', permId));
      return;
    } catch (e) {
      console.warn('Firestore deletePermission fallback', e);
    }
  }

  const perms = getLocalItem<SSOPermission[]>('permissions', defaultPermissions).filter(p => p.id !== permId);
  setLocalItem('permissions', perms);
}

// ----------------------------------------------------
// REGISTERED APPS (OAUTH CLIENTS)
// ----------------------------------------------------
export async function listRegisteredApps(): Promise<RegisteredApp[]> {
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDocs(collection(db, 'apps'));
      if (!snap.empty) {
        return snap.docs.map(d => d.data() as RegisteredApp);
      }
    } catch (e) {
      console.warn('Firestore listRegisteredApps fallback', e);
    }
  }

  const apps = getLocalItem<RegisteredApp[]>('apps', defaultApps);
  setLocalItem('apps', apps);
  return apps;
}

export async function getAppByClientId(clientId: string): Promise<RegisteredApp | null> {
  const apps = await listRegisteredApps();
  return apps.find(a => a.clientId === clientId && a.isActive) || null;
}

export async function saveRegisteredApp(appData: RegisteredApp): Promise<void> {
  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'apps', appData.id), appData, { merge: true });
      return;
    } catch (e) {
      console.warn('Firestore saveRegisteredApp fallback', e);
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
  if (isFirebaseConfigured()) {
    try {
      await deleteDoc(doc(db, 'apps', appId));
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
  if (isFirebaseConfigured()) {
    try {
      const snap = await getDoc(doc(db, 'settings', 'sso'));
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
  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'settings', 'sso'), updated, { merge: true });
      return;
    } catch (e) {
      console.warn('Firestore saveSSOSettings fallback', e);
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

  if (isFirebaseConfigured()) {
    try {
      await setDoc(doc(db, 'audit_logs', logItem.id), logItem);
    } catch (e) {
      console.warn('Firestore logSSOEvent fallback', e);
    }
  }

  const logs = getLocalItem<SSOAuditLog[]>('audit_logs', []);
  logs.unshift(logItem);
  if (logs.length > 100) logs.pop();
  setLocalItem('audit_logs', logs);
}

export async function getRecentAuditLogs(count: number = 20): Promise<SSOAuditLog[]> {
  if (isFirebaseConfigured()) {
    try {
      const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(count));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => d.data() as SSOAuditLog);
      }
    } catch (e) {
      console.warn('Firestore getRecentAuditLogs fallback', e);
    }
  }

  const logs = getLocalItem<SSOAuditLog[]>('audit_logs', []);
  return logs.slice(0, count);
}
