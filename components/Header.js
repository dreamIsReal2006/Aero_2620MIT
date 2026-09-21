'use client';

import { useState } from 'react';
import { Avatar, Glass, Icon } from './ui';

export default function Header({ user, onSearch, onProfile, onLogout }) {
  const [query, setQuery] = useState('');
  return <Glass className="fixed left-2 right-2 top-4 z-40 flex h-[60px] items-center justify-between rounded-full px-2 sm:left-6 sm:right-6 sm:px-5">
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button className="grid h-10 w-10 place-items-center rounded-full text-[#1c1e21] transition-transform duration-200 hover:-translate-y-0.5 md:hidden" aria-label="Open navigation"><span className="space-y-1"><i className="block h-0.5 w-5 bg-current" /><i className="block h-0.5 w-5 bg-current" /><i className="block h-0.5 w-5 bg-current" /></span></button>
      <div className="relative w-full max-w-[280px]">
        <div className="flex h-[42px] items-center gap-2 rounded-full border border-black/5 bg-black/[.04] px-3.5 transition-[width,box-shadow] duration-200 focus-within:shadow-[0_0_0_1px_rgba(96,146,255,.28),0_12px_38px_rgba(17,24,39,.12)]">
          <Icon name="search" className="h-5 w-5 shrink-0 text-[#65676b]" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); onSearch?.(event.target.value); }} onKeyDown={(event) => event.key === 'Enter' && onSearch?.(query)} className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[.95rem] outline-none placeholder:text-[#65676b]" placeholder="Search" aria-label="Search Aero" />
          {query && <button onClick={() => { setQuery(''); onSearch?.(''); }} className="text-xs text-[#65676b]" aria-label="Clear search">✕</button>}
        </div>
      </div>
    </div>
    <button onClick={onProfile} className="mx-3 hidden shrink-0 items-center gap-1 font-semibold text-[#0A84FF] sm:flex" aria-label="Go to Aero home">Aero <Icon name="sparkle" className="h-[18px] w-[18px]" /></button>
    <div className="flex shrink-0 items-center gap-2">
      <button onClick={onProfile} className="flex items-center gap-2 rounded-full bg-black/[.03] p-1.5 transition-transform duration-200 hover:-translate-y-0.5 sm:pr-2.5"><Avatar user={user} className="h-8 w-8 text-xs" /><span className="hidden max-w-24 truncate text-sm font-semibold sm:inline">{user?.display_name || user?.username || 'User'}</span><span onClick={(event) => { event.stopPropagation(); onLogout?.(); }} className="rounded-full p-1 text-[#65676b] hover:text-[#0A84FF]" role="button" aria-label="Sign out"><Icon name="logout" className="h-[18px] w-[18px]" /></span></button>
    </div>
  </Glass>;
}
