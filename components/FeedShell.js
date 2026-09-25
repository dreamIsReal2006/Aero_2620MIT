'use client';

import { useEffect, useRef, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import PostCard from './PostCard';
import UserSearchModal from './UserSearchModal';
import AuthPanel from './AuthPanel';
import { Avatar, Glass, Icon } from './ui';
import { getPostsFeed } from '../lib/supabaseData';
import { getValidUrl } from '../lib/apiUrl';

const apiHeaders = () => ({ Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('aero_token') || ''}` });

export default function FeedShell() {
  const [user, setUser] = useState(null); const [active, setActive] = useState('Home'); const [tab, setTab] = useState('for_you'); const [posts, setPosts] = useState([]); const [currentCursor, setCurrentCursor] = useState(null); const [isLoadingMore, setIsLoadingMore] = useState(false); const [hasMore, setHasMore] = useState(true); const [query, setQuery] = useState(''); const [search, setSearch] = useState({ users: [], posts: [] }); const [composerOpen, setComposerOpen] = useState(false); const [draft, setDraft] = useState('');
  const feedSentinelRef = useRef(null);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem('aero_user') || 'null'); if (localStorage.getItem('aero_token') && saved) setUser(saved); } catch {} }, []);
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setPosts([]); setCurrentCursor(null); setHasMore(true); setIsLoadingMore(true);
    getPostsFeed(tab, user.id, null, 10).then((result) => {
      if (cancelled) return;
      setPosts(result.posts || []); setCurrentCursor(result.next_cursor || null); setHasMore(Boolean(result.has_more)); setIsLoadingMore(false);
    });
    return () => { cancelled = true; };
  }, [user, tab]);
  useEffect(() => {
    const sentinel = feedSentinelRef.current;
    if (!sentinel || !user) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || !hasMore || isLoadingMore || !currentCursor) return;
      setIsLoadingMore(true);
      getPostsFeed(tab, user.id, currentCursor, 10).then((result) => {
        setPosts((current) => [...current, ...(result.posts || []).filter((post) => !current.some((item) => item.id === post.id))]);
        setCurrentCursor(result.next_cursor || null); setHasMore(Boolean(result.has_more));
      }).finally(() => setIsLoadingMore(false));
    }, { rootMargin: '300px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentCursor, hasMore, isLoadingMore, tab, user]);
  if (!user) return <AuthPanel onAuthenticated={setUser} />;
  const logout = () => { localStorage.removeItem('aero_token'); localStorage.removeItem('aero_user'); setUser(null); };
  const publish = async (event) => { event.preventDefault(); if (!draft.trim()) return; const response = await fetch(getValidUrl('posts'), { method: 'POST', headers: { ...apiHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draft.trim(), images: [] }) }); if (response.ok) { setDraft(''); setComposerOpen(false); const created = await response.json(); setPosts((current) => [created.post || created, ...current]); } };
  const navigate = (label) => { if (label === 'Post') setComposerOpen(true); else if (label === 'Profile') setActive('Profile'); else if (label === 'Home') setActive('Home'); else setActive(label); };
  return <><div className="aero-bg" aria-hidden="true"><span className="aero-glow aero-glow-one" /><span className="aero-glow aero-glow-two" /><span className="aero-glow aero-glow-three" /></div><Header user={user} onSearch={setQuery} onProfile={() => setActive('Profile')} onLogout={logout} /><Sidebar active={active} onNavigate={navigate} /><div className="mx-auto flex max-w-[1200px] justify-center gap-6 px-3 pb-24 pt-[100px] md:px-0"><main className="w-full max-w-[620px]">{active === 'Home' ? <><div className="relative mb-3 flex items-center gap-3 border-b-0 px-2 pt-1"><button onClick={() => setTab('for_you')} className={`border-b-[3px] px-0 pb-2 text-[.82rem] font-bold ${tab === 'for_you' ? 'border-[#0A84FF] text-[#1c1e21]' : 'border-transparent text-[#65676b]'}`}>For You</button><button onClick={() => setTab('following')} className={`border-b-[3px] px-0 pb-2 text-[.82rem] font-bold ${tab === 'following' ? 'border-[#0A84FF] text-[#1c1e21]' : 'border-transparent text-[#65676b]'}`}>Following</button>{query && <UserSearchModal query={query} users={search.users} posts={search.posts} onClose={() => setQuery('')} />}</div><button onClick={() => setComposerOpen(true)} className="mb-6 flex min-h-[72px] w-full items-center justify-between gap-4 rounded-3xl border border-white/60 bg-white/65 p-4 text-left text-[#65676b] shadow-glass backdrop-blur-2xl transition-transform duration-200 hover:-translate-y-0.5"><span className="flex min-w-0 items-center gap-3"><Avatar user={user} className="h-9 w-9 text-sm" /><span className="truncate">Share what's on your mind...</span></span><span className="hidden items-center gap-1 text-sm text-[#0A84FF] sm:flex"><Icon name="image" className="h-[18px] w-[18px]" />Add media</span></button>{posts.length ? posts.map((post) => <PostCard key={post.id} post={post} />) : <Glass className="rounded-[20px] p-8 text-center text-[#65676b]">No posts found</Glass>}<div ref={feedSentinelRef} id="feed-sentinel" className={`feed-sentinel ${isLoadingMore ? 'is-loading' : ''}`} aria-hidden={!isLoadingMore}>{isLoadingMore && <span className="loading-spinner" aria-label="Loading more posts" />}</div></> : <Glass className="rounded-[20px] p-8"><h1 className="mb-2 text-2xl font-bold">{active}</h1><p className="text-[#65676b]">This view keeps the original Aero navigation ready for its API-backed module.</p></Glass>}</main></div>{composerOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-md"><Glass className="aero-pop w-full max-w-[620px] rounded-[20px] p-5"><form onSubmit={publish}><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><Avatar user={user} /><div><h2 className="font-bold">Create post</h2><span className="text-sm text-[#65676b]">{user.display_name || user.username}</span></div></div><button type="button" onClick={() => setComposerOpen(false)} className="text-2xl text-[#65676b]" aria-label="Close">&times;</button></div><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} className="min-h-40 w-full resize-y rounded-2xl border border-white/70 bg-white/30 p-3 outline-none focus:border-[#0A84FF]" placeholder="Share what's on your mind..." /><div className="mt-4 flex justify-end"><button disabled={!draft.trim()} className="rounded-2xl bg-[#0A84FF] px-5 py-2 font-semibold text-white disabled:opacity-50">Post</button></div></form></Glass></div>}</>;
}
