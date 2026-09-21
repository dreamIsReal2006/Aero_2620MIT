'use client';

import { useState } from 'react';
import { Glass } from './ui';
import { getValidUrl } from '../lib/apiUrl';

export default function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const path = mode === 'signin' ? '/auth/signin' : '/auth/signup';
      const response = await fetch(getValidUrl(path.slice(1)), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Unable to authenticate');
      const token = data.token || data.access_token || data.accessToken;
      if (token) localStorage.setItem('aero_token', token);
      const user = data.user || data.data?.user || { username: form.username, display_name: form.username };
      localStorage.setItem('aero_user', JSON.stringify(user)); onAuthenticated(user);
    } catch (caught) { setError(caught.message); } finally { setLoading(false); }
  };
  return <div className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center bg-slate-900/20 p-5 backdrop-blur-2xl"><Glass className="aero-pop flex w-[880px] max-w-full overflow-hidden rounded-[20px] shadow-2xl"><div className="relative hidden min-h-[540px] flex-1 bg-black md:block"><img src="https://picsum.photos/800/1000" alt="Aero Art" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" /></div><div className="flex min-h-[540px] flex-1 flex-col justify-center p-8 sm:p-10"><h1 className="mb-8 text-3xl font-bold text-[#0A84FF]">Aero</h1><form onSubmit={submit}><h2 className="mb-1 text-[1.6rem]">{mode === 'signin' ? 'Hello !' : 'Welcome'}</h2><p className="mb-6 text-sm text-[#65676b]">{mode === 'signin' ? 'Welcome back to your fluid space.' : 'Create an account to join Aero.'}</p>{mode === 'signup' && <input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mb-4 w-full rounded-2xl border border-white/70 bg-white/30 px-4 py-3 outline-none focus:border-[#0A84FF]" placeholder="Email Address" type="email" />}<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="mb-4 w-full rounded-2xl border border-white/70 bg-white/30 px-4 py-3 outline-none focus:border-[#0A84FF]" placeholder="Username" /><input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mb-2 w-full rounded-2xl border border-white/70 bg-white/30 px-4 py-3 outline-none focus:border-[#0A84FF]" placeholder="Password" type="password" />{error && <p className="mb-3 text-xs text-[#FF3B30]">{error}</p>}<div className="mb-6 flex justify-between text-sm"><button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="text-[#0A84FF]">{mode === 'signin' ? 'Create Account' : 'Already have an account? Sign In'}</button>{mode === 'signin' && <button type="button" className="text-[#0A84FF]">Forgot?</button>}</div><button disabled={loading} className="w-full rounded-2xl bg-[#0A84FF] px-4 py-3 font-semibold text-white transition duration-200 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60">{loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Continue'}</button></form></div></Glass></div>;
}
