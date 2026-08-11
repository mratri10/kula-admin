/* eslint-disable @typescript-eslint/no-explicit-any */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy
} from 'firebase/firestore';

export interface WhitelistedUtama {
  email: string;
  familyName: string;
  registeredBy: string;
  createdAt: string;
  status: 'active' | 'inactive';
  members: string[];
  memberDetails?: { name: string; email: string }[];
  gdriveFileId?: string | null;
  lastSyncedAt?: string | null;
  subscriptionPlan?: string;
  subscriptionValidUntil?: string | null;
  alias?: string;
  expiredDate?: string | null;
}

export interface FirebaseConfigStatus {
  isConnected: boolean;
  projectId: string | null;
  usingFallback: boolean;
}

export function getFirebaseConfiguration() {
  let customConfig: any = null;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('kula_firebase_custom_config');
    if (saved) {
      try { customConfig = JSON.parse(saved); } catch { /* ignore */ }
    }
  }

  const apiKey = customConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = customConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'kulafam-default';
  const appId = customConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID;
  const storageBucket = customConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
  const authDomain = customConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;
  const messagingSenderId = customConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const measurementId = customConfig?.measurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;

  if (!apiKey) {
    return { valid: false, config: null, projectId: null };
  }

  return {
    valid: true,
    projectId,
    config: {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId: appId || '1:1234567890:web:kula123',
      measurementId,
    },
  };
}

export function saveCustomFirebaseConfig(apiKey: string, projectId: string, appId?: string) {
  if (typeof window === 'undefined') return;
  if (!apiKey || !projectId) {
    localStorage.removeItem('kula_firebase_custom_config');
    return;
  }
  localStorage.setItem('kula_firebase_custom_config', JSON.stringify({ apiKey, projectId, appId }));
}

function getFirestoreInstance() {
  const { valid, config } = getFirebaseConfiguration();
  if (!valid || !config) return null;

  try {
    const app = !getApps().length ? initializeApp(config, 'KulaAdminApp') : getApp('KulaAdminApp');
    return getFirestore(app);
  } catch (err) {
    console.warn('Firebase init failed, using localStorage fallback:', err);
    return null;
  }
}

const LOCAL_KEY_WHITELIST = 'kula_admin_whitelisted_utamas_v2';

function getLocalWhitelistedUtamas(): WhitelistedUtama[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_KEY_WHITELIST);
  if (!stored) {
    const defaultList: WhitelistedUtama[] = [];
    localStorage.setItem(LOCAL_KEY_WHITELIST, JSON.stringify(defaultList));
    return defaultList;
  }
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map((item: any) => ({
      ...item,
      members: Array.isArray(item.members) ? item.members : []
    })) : [];
  } catch {
    return [];
  }
}

function saveLocalWhitelistedUtamas(list: WhitelistedUtama[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_KEY_WHITELIST, JSON.stringify(list));
  }
}

export async function checkFirebaseStatus(): Promise<FirebaseConfigStatus> {
  const db = getFirestoreInstance();
  const { valid, projectId } = getFirebaseConfiguration();
  return {
    isConnected: !!db,
    projectId: projectId || 'Local Offline Database',
    usingFallback: !db || !valid,
  };
}

export async function getWhitelistedUtamas(): Promise<WhitelistedUtama[]> {
  const db = getFirestoreInstance();
  if (!db) return getLocalWhitelistedUtamas();

  try {
    const q = query(collection(db, 'whitelisted_utamas'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const results: WhitelistedUtama[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      results.push({
        ...data,
        members: Array.isArray(data.members) ? data.members : []
      } as WhitelistedUtama);
    });
    saveLocalWhitelistedUtamas(results);
    return results;
  } catch (err) {
    console.error('Firestore fetch failed, using local fallback:', err);
    return getLocalWhitelistedUtamas();
  }
}

export function calculateExpirationDate(duration: string, customDate?: string): string {
  if (duration === 'custom' && customDate) {
    const d = new Date(customDate);
    if (!isNaN(d.getTime())) {
      // Set to end of the day or exact date selected
      return d.toISOString();
    }
  }

  const now = new Date();
  switch (duration) {
    case '1m':
      now.setMonth(now.getMonth() + 1);
      break;
    case '3m':
      now.setMonth(now.getMonth() + 3);
      break;
    case '6m':
      now.setMonth(now.getMonth() + 6);
      break;
    case '1y':
      now.setFullYear(now.getFullYear() + 1);
      break;
    default:
      now.setMonth(now.getMonth() + 1);
      break;
  }
  return now.toISOString();
}

export async function registerUtamaEmail(
  email: string, 
  alias: string, 
  adminName = 'Admin',
  duration = '1m',
  customDate?: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Format email tidak valid.' };
  }

  const expiredDate = calculateExpirationDate(duration, customDate);
  const planLabel = duration === '1y' ? 'paid' : duration === '1m' ? 'free' : duration;

  const newEntry: WhitelistedUtama = {
    email: cleanEmail,
    alias: alias.trim() || `Alias ${cleanEmail.split('@')[0]}`,
    registeredBy: adminName,
    createdAt: new Date().toISOString(),
    status: 'active',
    members: [],
    gdriveFileId: null,
    subscriptionPlan: planLabel as any,
    expiredDate: expiredDate,
    familyName: ''
  };

  const db = getFirestoreInstance();
  if (db) {
    try {
      const docRef = doc(db, 'whitelisted_utamas', cleanEmail);
      await setDoc(docRef, newEntry, { merge: true });
    } catch (err) {
      console.error('Firestore save failed, saving local:', err);
    }
  }

  const localList = getLocalWhitelistedUtamas();
  const existingIndex = localList.findIndex((u) => u.email === cleanEmail);
  if (existingIndex >= 0) {
    localList[existingIndex] = { ...localList[existingIndex], ...newEntry, status: 'active' };
  } else {
    localList.unshift(newEntry);
  }
  saveLocalWhitelistedUtamas(localList);

  return { success: true };
}

export async function removeUtamaEmail(email: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  const db = getFirestoreInstance();
  if (db) {
    try {
      await deleteDoc(doc(db, 'whitelisted_utamas', cleanEmail));
    } catch (err) {
      console.error('Firestore delete error:', err);
    }
  }

  const localList = getLocalWhitelistedUtamas().filter((u) => u.email !== cleanEmail);
  saveLocalWhitelistedUtamas(localList);
  return true;
}

export async function toggleUtamaStatus(email: string): Promise<WhitelistedUtama | null> {
  const cleanEmail = email.trim().toLowerCase();
  const list = await getWhitelistedUtamas();
  const target = list.find((u) => u.email === cleanEmail);
  if (!target) return null;

  const updatedStatus = target.status === 'active' ? 'inactive' : 'active';
  const updatedEntry: WhitelistedUtama = { ...target, status: updatedStatus };

  const db = getFirestoreInstance();
  if (db) {
    try {
      await setDoc(doc(db, 'whitelisted_utamas', cleanEmail), { status: updatedStatus }, { merge: true });
    } catch (err) {
      console.error('Firestore update status error:', err);
    }
  }

  const localList = getLocalWhitelistedUtamas().map((u) =>
    u.email === cleanEmail ? updatedEntry : u
  );
  saveLocalWhitelistedUtamas(localList);
  return updatedEntry;
}

export async function updateAccountDuration(
  email: string,
  duration: string,
  customDate?: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const list = await getWhitelistedUtamas();
  const target = list.find((u) => u.email === cleanEmail);

  if (!target) return { success: false, error: 'Akun Utama tidak ditemukan.' };

  const expiredDate = calculateExpirationDate(duration, customDate);
  const planLabel = duration === '1y' ? 'paid' : duration === '1m' ? 'free' : duration;

  const updatedEntry: WhitelistedUtama = {
    ...target,
    subscriptionPlan: planLabel as any,
    expiredDate: expiredDate,
    status: 'active' // Auto activate on renew
  };

  const db = getFirestoreInstance();
  if (db) {
    try {
      await setDoc(doc(db, 'whitelisted_utamas', cleanEmail), {
        subscriptionPlan: updatedEntry.subscriptionPlan,
        expiredDate: updatedEntry.expiredDate,
        status: updatedEntry.status
      }, { merge: true });
    } catch (err) {
      console.error('Firestore update duration error:', err);
    }
  }

  const localList = getLocalWhitelistedUtamas().map((u) =>
    u.email === cleanEmail ? updatedEntry : u
  );
  saveLocalWhitelistedUtamas(localList);
  return { success: true };
}

export async function updateSubscription(
  email: string,
  plan: 'free' | 'paid'
): Promise<{ success: boolean; error?: string }> {
  return updateAccountDuration(email, plan === 'paid' ? '1y' : '1m');
}

