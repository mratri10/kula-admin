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
  gdriveFileId?: string | null;
  lastSyncedAt?: string | null;
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

  if (!apiKey) {
    return { valid: false, config: null, projectId: null };
  }

  return {
    valid: true,
    projectId,
    config: {
      apiKey,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: `${projectId}.appspot.com`,
      appId: appId || '1:1234567890:web:kula123',
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
    const defaultList: WhitelistedUtama[] = [
      {
        email: 'atrialfa@gmail.com',
        familyName: 'Keluarga Atri Alfa (Utama)',
        registeredBy: 'Admin (Default)',
        createdAt: new Date().toISOString(),
        status: 'active',
        members: ['istri@gmail.com', 'anak@gmail.com'],
        gdriveFileId: null,
      }
    ];
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

export async function registerUtamaEmail(email: string, familyName: string, adminName = 'Admin'): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Format email tidak valid.' };
  }

  const newEntry: WhitelistedUtama = {
    email: cleanEmail,
    familyName: familyName.trim() || `Keluarga ${cleanEmail.split('@')[0]}`,
    registeredBy: adminName,
    createdAt: new Date().toISOString(),
    status: 'active',
    members: [],
    gdriveFileId: null,
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

export async function addMemberToUtama(utamaEmail: string, memberEmail: string): Promise<{ success: boolean; error?: string }> {
  const cleanUtama = utamaEmail.trim().toLowerCase();
  const cleanMember = memberEmail.trim().toLowerCase();

  if (!cleanMember || !cleanMember.includes('@')) {
    return { success: false, error: 'Format email anggota tidak valid.' };
  }

  const list = await getWhitelistedUtamas();
  const target = list.find((u) => u.email === cleanUtama);
  if (!target) return { success: false, error: 'Akun Utama tidak ditemukan.' };

  const currentMembers = target.members || [];
  if (currentMembers.includes(cleanMember)) {
    return { success: false, error: `Email ${cleanMember} sudah terdaftar di Akun Utama ini.` };
  }

  const updatedMembers = [...currentMembers, cleanMember];
  const db = getFirestoreInstance();
  if (db) {
    try {
      await setDoc(doc(db, 'whitelisted_utamas', cleanUtama), { members: updatedMembers }, { merge: true });
    } catch (err) {
      console.error('Firestore add member error:', err);
    }
  }

  const localList = getLocalWhitelistedUtamas().map((u) =>
    u.email === cleanUtama ? { ...u, members: updatedMembers } : u
  );
  saveLocalWhitelistedUtamas(localList);
  return { success: true };
}

export async function removeMemberFromUtama(utamaEmail: string, memberEmail: string): Promise<{ success: boolean; error?: string }> {
  const cleanUtama = utamaEmail.trim().toLowerCase();
  const cleanMember = memberEmail.trim().toLowerCase();

  const list = await getWhitelistedUtamas();
  const target = list.find((u) => u.email === cleanUtama);
  if (!target) return { success: false, error: 'Akun Utama tidak ditemukan.' };

  const updatedMembers = (target.members || []).filter((m) => m !== cleanMember);
  const db = getFirestoreInstance();
  if (db) {
    try {
      await setDoc(doc(db, 'whitelisted_utamas', cleanUtama), { members: updatedMembers }, { merge: true });
    } catch (err) {
      console.error('Firestore remove member error:', err);
    }
  }

  const localList = getLocalWhitelistedUtamas().map((u) =>
    u.email === cleanUtama ? { ...u, members: updatedMembers } : u
  );
  saveLocalWhitelistedUtamas(localList);
  return { success: true };
}
