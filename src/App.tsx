import React, { useState, useEffect } from 'react';
import { 
  getWhitelistedUtamas, 
  registerUtamaEmail, 
  removeUtamaEmail, 
  toggleUtamaStatus,
  checkFirebaseStatus,
  saveCustomFirebaseConfig,
  addMemberToUtama,
  removeMemberFromUtama,
  type WhitelistedUtama,
  type FirebaseConfigStatus 
} from './services/firebaseService';
import { 
  ShieldCheck, 
  Database, 
  Users, 
  UserPlus, 
  Trash2, 
  Power, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound,
  ExternalLink,
  Plus,
  X,
  Server
} from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [utamas, setUtamas] = useState<WhitelistedUtama[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Member management input map: { [utamaEmail: string]: string }
  const [memberInputMap, setMemberInputMap] = useState<Record<string, string>>({});

  // Firebase Config State
  const [dbStatus, setDbStatus] = useState<FirebaseConfigStatus | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [projectIdInput, setProjectIdInput] = useState('');
  const [appIdInput, setAppIdInput] = useState('');
  const [showDbConfig, setShowDbConfig] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      checkDbStatus();
    }
  }, [isAuthenticated]);

  const checkDbStatus = async () => {
    const status = await checkFirebaseStatus();
    setDbStatus(status);
  };

  const loadData = async () => {
    setIsLoading(true);
    const list = await getWhitelistedUtamas();
    setUtamas(list);
    setIsLoading(false);
  };

  const handlePinLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '123456') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('PIN Administrator Kula Salah! (Default PIN tes: 123456)');
    }
  };

  const handleAddUtama = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await registerUtamaEmail(newEmail, newFamilyName, 'Administrator (Web Admin 3002)');
    if (res.success) {
      setSuccessMsg(`Berhasil mendaftarkan Akun Utama ${newEmail} ke dalam database!`);
      setNewEmail('');
      setNewFamilyName('');
      loadData();
    } else {
      setErrorMsg(res.error || 'Gagal menambahkan email Utama.');
    }
  };

  const handleDeleteUtama = async (email: string) => {
    if (!window.confirm(`Yakin ingin mencabut otorisasi Kepala Keluarga untuk email ${email}?`)) return;
    await removeUtamaEmail(email);
    setSuccessMsg(`Email ${email} telah dicabut.`);
    loadData();
  };

  const handleToggleStatus = async (email: string) => {
    await toggleUtamaStatus(email);
    loadData();
  };

  const handleAddMember = async (utamaEmail: string) => {
    const memberEmail = memberInputMap[utamaEmail]?.trim();
    if (!memberEmail) return;

    setErrorMsg(null);
    const res = await addMemberToUtama(utamaEmail, memberEmail);
    if (res.success) {
      setSuccessMsg(`Anggota (${memberEmail}) berhasil ditambahkan ke Akun Utama ${utamaEmail}`);
      setMemberInputMap((prev) => ({ ...prev, [utamaEmail]: '' }));
      loadData();
    } else {
      setErrorMsg(res.error || 'Gagal menambahkan anggota.');
    }
  };

  const handleRemoveMember = async (utamaEmail: string, memberEmail: string) => {
    if (!window.confirm(`Hapus izin Anggota ${memberEmail} dari Akun Utama ini?`)) return;
    await removeMemberFromUtama(utamaEmail, memberEmail);
    setSuccessMsg(`Anggota ${memberEmail} telah dihapus.`);
    loadData();
  };

  const handleSaveFirebaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomFirebaseConfig(apiKeyInput.trim(), projectIdInput.trim(), appIdInput.trim());
    setSuccessMsg('Konfigurasi Cloud Database disimpan ke browser/storage.');
    setShowDbConfig(false);
    await checkDbStatus();
    await loadData();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/3 right-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="max-w-md w-full backdrop-blur-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-r from-purple-500 to-indigo-500 text-white flex items-center justify-center mx-auto mb-5 shadow-lg shadow-purple-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Kula Admin Microservice</h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">Layanan Otorisasi Akun Utama &amp; Whitelist Anggota (Port 3002)</p>

          <form onSubmit={handlePinLogin} className="mt-6 space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center">
                <KeyRound className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                <span>PIN Administrator:</span>
              </label>
              <input
                type="password"
                required
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Masukkan PIN (Default: 123456)"
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center font-mono text-sm tracking-widest text-white focus:outline-none focus:border-purple-500 transition-all"
              />
            </div>
            {authError && (
              <p className="text-xs text-rose-400 bg-rose-950/30 p-2.5 rounded-xl border border-rose-900 text-center font-medium">
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-linear-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              Masuk Portal Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Navbar & Microservice Switchers */}
        <header className="flex flex-col sm:flex-row items-center justify-between p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-linear-to-r from-purple-500 to-indigo-500 text-white flex items-center justify-center font-black text-lg shadow-md">
              A
            </div>
            <div>
              <h1 className="text-xl font-black text-white flex items-center">
                <span>Kula Admin Portal</span>
                <span className="ml-2.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-[10px] text-purple-400 uppercase tracking-widest font-mono">
                  Port 3002
                </span>
              </h1>
              <p className="text-xs text-slate-400">Pusat Otorisasi Registrasi Kepala Keluarga &amp; Verifikasi Anggota</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-bold w-full sm:w-auto justify-end">
            <a 
              href="http://localhost:3001" 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors flex items-center shadow-xs cursor-pointer"
            >
              <span>Landing Web</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-slate-500" />
            </a>
            <a 
              href="http://localhost:3000" 
              target="_blank" 
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 transition-colors flex items-center shadow-xs cursor-pointer"
            >
              <span>Financial Web</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-sky-500" />
            </a>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition-colors cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </header>

        {/* Database Status Banner */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
          <div className="flex items-center space-x-3">
            <Server className={`w-6 h-6 ${dbStatus?.isConnected && !dbStatus?.usingFallback ? 'text-emerald-400' : 'text-amber-400'}`} />
            <div>
              <div className="text-xs font-bold text-slate-300 flex items-center space-x-2">
                <span>Database Status:</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono ${dbStatus?.usingFallback ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}`}>
                  {dbStatus?.usingFallback ? 'Mode Offline / Fallback Sync' : `Connected (${dbStatus?.projectId})`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Semua perubahan daftar email langsung terotorisasi saat login di aplikasi Financial (Port 3000).</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowDbConfig(!showDbConfig)}
            className="text-xs font-bold text-purple-400 hover:text-purple-300 underline cursor-pointer"
          >
            {showDbConfig ? 'Tutup Pengaturan Cloud DB' : 'Konfigurasi Cloud Database'}
          </button>
        </div>

        {/* Optional Firebase DB Config Modal */}
        {showDbConfig && (
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-purple-500/30 shadow-xl space-y-4 animate-fadeIn">
            <div className="flex items-center space-x-2 text-purple-300 font-bold text-sm">
              <Database className="w-4 h-4 text-purple-400" />
              <span>Hubungkan ke Firebase Real Database</span>
            </div>
            <form onSubmit={handleSaveFirebaseConfig} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Firebase API Key</label>
                <input
                  type="text"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Project ID</label>
                <input
                  type="text"
                  value={projectIdInput}
                  onChange={(e) => setProjectIdInput(e.target.value)}
                  placeholder="kulafam-proj-id"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">App ID</label>
                <input
                  type="text"
                  value={appIdInput}
                  onChange={(e) => setAppIdInput(e.target.value)}
                  placeholder="1:123456:web:abcd..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                />
              </div>
              <div className="sm:col-span-3 flex justify-end space-x-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Simpan &amp; Hubungkan Database
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Notifications */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Registration Form (Add New Akun Utama) */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center space-x-2 text-sm font-bold text-white">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <span>Daftarkan Akun Utama / Kepala Keluarga Baru</span>
          </div>
          
          <form onSubmit={handleAddUtama} className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
            <div className="sm:col-span-5">
              <label className="block text-slate-400 mb-1 font-semibold">Email Akun Utama (Gmail)</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="contoh: budi.utama@gmail.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-slate-400 mb-1 font-semibold">Nama Keluarga / Keterangan</label>
              <input
                type="text"
                required
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="Keluarga Budi Utama"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-xs"
              />
            </div>
            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold shadow-md transition-all cursor-pointer"
              >
                + Otorisasi Akun Utama
              </button>
            </div>
          </form>
        </div>

        {/* Registered Utamas & Members List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-400" />
              <span>Daftar Otorisasi Akun Utama &amp; Anggota Terdaftar</span>
            </h2>
            <span className="text-xs text-slate-400">Total: {utamas.length} Akun Utama</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Memuat data otorisasi Kula...</div>
          ) : utamas.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-3xl text-slate-400 text-sm">
              Belum ada Akun Utama terdaftar. Tambahkan akun baru di atas!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {utamas.map((u) => (
                <div 
                  key={u.email} 
                  className={`p-5 rounded-3xl border transition-all ${
                    u.status === 'active' ? 'bg-slate-900 border-slate-800 shadow-lg' : 'bg-slate-900/40 border-rose-900/30 opacity-70'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono font-bold text-sky-300">{u.email}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                          u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {u.status}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-300">{u.familyName}</div>
                      <div className="text-[11px] text-slate-500">
                        Oleh: {u.registeredBy} • Terakhir Sync: {u.lastSyncedAt ? new Date(u.lastSyncedAt).toLocaleString('id-ID') : 'Belum sync Excel'}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleToggleStatus(u.email)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                          u.status === 'active'
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUtama(u.email)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>

                  {/* AUTHORIZED MEMBER EMAILS SECTION (NEW FEATURE FOR MEMBER VALIDATION) */}
                  <div className="mt-4 pt-1 space-y-3">
                    <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span className="text-emerald-400">Daftar Email Anggota (Member Terotorisasi):</span>
                      <span className="text-[11px] text-slate-400">Anggota ini dapat masuk di Port 3000 tanpa login berulang via cookies</span>
                    </div>

                    {/* Badge List */}
                    <div className="flex flex-wrap gap-2">
                      {(!u.members || u.members.length === 0) ? (
                        <span className="text-xs text-slate-500 italic py-1">Belum ada anggota diotorisasi untuk Akun Utama ini.</span>
                      ) : (
                        u.members.map((memberEmail) => (
                          <div 
                            key={memberEmail} 
                            className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-mono flex items-center space-x-2 shadow-sm"
                          >
                            <span>{memberEmail}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(u.email, memberEmail)}
                              className="w-4 h-4 rounded-full hover:bg-rose-500 hover:text-white flex items-center justify-center text-rose-400 transition-colors cursor-pointer"
                              title={`Hapus otorisasi ${memberEmail}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Member Quick Input Block */}
                    <div className="flex items-center space-x-2 max-w-md pt-1">
                      <input
                        type="email"
                        value={memberInputMap[u.email] || ''}
                        onChange={(e) => setMemberInputMap((prev) => ({ ...prev, [u.email]: e.target.value }))}
                        placeholder="tambah email anggota (contoh: anak@gmail.com)"
                        className="grow px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(u.email); }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddMember(u.email)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 flex items-center shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        <span>Tambah Anggota</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
