'use client';

import { Avatar, Glass } from './ui';

export default function UserSearchModal({ query, users = [], posts = [], onClose, onSelect }) {
  if (!query) return null;
  return <Glass className="aero-pop absolute left-0 top-[54px] z-50 w-[min(420px,calc(100vw-32px))] rounded-3xl p-3 shadow-2xl"><div className="border-b border-black/10 px-2 pb-2 text-[.72rem] font-bold uppercase tracking-[.08em] text-[#65676b]">Search results</div><div className="flex flex-col gap-1 pt-2">{users.slice(0, 3).map((user) => <button key={user.id || user.username} onClick={() => onSelect?.(user)} className="flex items-center gap-2 rounded-2xl p-2 text-left hover:bg-[#0A84FF]/[.06]"><Avatar user={user} className="h-9 w-9 text-xs" /><span className="min-w-0"><strong className="block truncate text-sm">@{user.username}</strong><small className="block truncate text-[#65676b]">{user.email || 'Member'}</small></span></button>)}{posts.slice(0, 3).map((post) => <button key={post.id} onClick={() => onSelect?.(post)} className="rounded-2xl p-2 text-left hover:bg-[#0A84FF]/[.06]"><strong className="block truncate text-sm">{post.content || 'Untitled post'}</strong><small className="text-[#65676b]">by @{post.username || 'User'}</small></button>)}{!users.length && !posts.length && <p className="p-3 text-sm text-[#65676b]">No results found</p>}</div><button onClick={onClose} className="mt-2 w-full rounded-xl py-1 text-xs text-[#65676b] hover:bg-black/5">Close</button></Glass>;
}
