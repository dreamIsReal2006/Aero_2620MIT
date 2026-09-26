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

async function getFeedPage(feedType, userId, cursor, limit) {
  if (feedType !== 'for_you') return getPostsFeed(feedType, userId, cursor, limit);
  const params = new URLSearchParams({ feed_type: feedType, limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  try {
    const response = await fetch(getValidUrl(`api/posts?${params.toString()}`), { headers: apiHeaders() });
    if (!response.ok) throw new Error('Unable to load recommended posts');
    return await response.json();
  } catch {
    return getPostsFeed(feedType, userId, cursor, limit);
  }
}

function installMentionPicker(textarea) {
  const menu = document.createElement('div');
    menu.className = 'mention-dropdown-menu hidden';
  menu.setAttribute('role', 'listbox');
  document.body.appendChild(menu);
  let match = null;
  let items = [];
  let activeIndex = -1;
  let timer;
  let requestId = 0;

  const hide = () => {
    requestId += 1;
    window.clearTimeout(timer);
    match = null;
    items = [];
    activeIndex = -1;
    menu.classList.add('hidden');
  };
  const showMessage = (message) => {
    const status = document.createElement('div');
    status.className = 'mention-empty-state';
    status.setAttribute('role', 'status');
    status.textContent = message;
    menu.replaceChildren(status);
    menu.classList.remove('hidden');
    position();
  };
  const position = () => {
    if (!match) return;
    const rect = textarea.getBoundingClientRect();
    const style = getComputedStyle(textarea);
    const mirror = document.createElement('div');
    ['font', 'padding', 'border', 'boxSizing', 'lineHeight', 'letterSpacing', 'textIndent', 'textTransform'].forEach((key) => { mirror.style[key] = style[key]; });
    Object.assign(mirror.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', overflow: 'hidden' });
    mirror.textContent = textarea.value.slice(0, textarea.selectionStart);
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    mirror.scrollTop = textarea.scrollTop;
    const caret = marker.getBoundingClientRect();
    mirror.remove();
    const menuWidth = Math.min(280, window.innerWidth - 16);
    const menuHeight = Math.min(menu.offsetHeight || 48, 250);
    menu.style.left = `${Math.max(8, Math.min(caret.left, window.innerWidth - menuWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(caret.bottom + 6, window.innerHeight - menuHeight - 8))}px`;
  };
  const choose = (item) => {
    if (!match || !item) return;
    const selectedMatch = match;
    const insertion = selectedMatch.kind === 'mention' ? `@${item.user.username} ` : `#${item.tag} `;
    const value = `${textarea.value.slice(0, selectedMatch.start)}${insertion}${textarea.value.slice(selectedMatch.end)}`;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const cursor = selectedMatch.start + insertion.length;
    hide();
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(cursor, cursor); });
  };
  const render = (payload, currentMatch) => {
    if (currentMatch.kind === 'hashtag') {
      const tags = Array.isArray(payload.hashtags) ? payload.hashtags : [];
      const exact = tags.some((item) => item.tag.toLocaleLowerCase() === currentMatch.query.toLocaleLowerCase());
      items = [
        ...(currentMatch.query && !exact ? [{ tag: currentMatch.query, create: true }] : []),
        ...tags.map((item) => ({ tag: item.tag, postCount: item.post_count, create: false })),
      ];
      activeIndex = items.length ? 0 : -1;
      menu.replaceChildren();
      items.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `mention-user-item${index === activeIndex ? ' is-active' : ''}`;
        button.dataset.mentionIndex = String(index);
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(index === activeIndex));
        const label = document.createElement('strong');
        label.textContent = item.create ? `创建标签 #${item.tag}` : `#${item.tag}`;
        button.appendChild(label);
        if (!item.create) {
          const count = document.createElement('small');
          count.className = 'mention-following-badge';
          count.textContent = `${item.postCount || 0} 帖子`;
          button.appendChild(count);
        }
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => choose(item));
        menu.appendChild(button);
      });
      if (items.length) { menu.classList.remove('hidden'); position(); }
      else showMessage('暂无热门标签');
      return;
    }
    const groups = [{ label: 'Following', users: payload.friends || [] }, { label: 'Other people', users: payload.others || [] }];
    items = groups.flatMap((group) => group.users.map((user) => ({ user, group: group.label })));
    activeIndex = items.length ? 0 : -1;
    menu.replaceChildren();
    groups.forEach((group) => {
      if (!group.users.length) return;
      const header = document.createElement('div');
      header.className = 'mention-section-header';
      header.textContent = group.label;
      menu.appendChild(header);
      group.users.forEach((user) => {
        const index = items.findIndex((item) => item.user.id === user.id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `mention-user-item${index === activeIndex ? ' is-active' : ''}`;
        button.dataset.mentionIndex = String(index);
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(index === activeIndex));
        const avatar = document.createElement(user.avatar_url ? 'img' : 'span');
        avatar.className = user.avatar_url ? '' : 'mention-avatar-fallback';
        if (user.avatar_url) { avatar.src = user.avatar_url; avatar.alt = ''; }
        const details = document.createElement('span');
        details.className = 'mention-user-copy';
        const username = document.createElement('strong');
        username.textContent = `@${user.username}`;
        const displayName = document.createElement('small');
        displayName.textContent = user.display_name || user.username;
        details.append(username, displayName);
        button.append(avatar, details);
        if (group.label === 'Following') {
          const badge = document.createElement('span');
          badge.className = 'mention-following-badge';
          badge.textContent = 'Following';
          button.appendChild(badge);
        }
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => choose({ user }));
        menu.appendChild(button);
      });
    });
    if (items.length) {
      menu.classList.remove('hidden');
      position();
    } else showMessage('暂无关注用户');
  };
  const update = () => {
    const prefix = textarea.value.slice(0, textarea.selectionStart);
    const found = prefix.match(/(^|[\s([{])([@#])([\p{L}\p{N}_.-]*)$/u);
    if (!found || textarea.selectionStart !== textarea.selectionEnd) { hide(); return; }
    const kind = found[2] === '@' ? 'mention' : 'hashtag';
    if (kind === 'mention' && !/^[A-Za-z0-9_.-]*$/.test(found[3])) { hide(); return; }
    match = { start: textarea.selectionStart - found[0].length + found[1].length, end: textarea.selectionStart, query: found[3], kind };
    showMessage('正在寻找用户...');
    const currentMatch = match;
    window.clearTimeout(timer);
    const currentRequest = ++requestId;
    timer = window.setTimeout(async () => {
      try {
          const endpoint = currentMatch.kind === 'mention' ? 'api/users/search-mention' : 'api/hashtags/search';
          const response = await fetch(`${getValidUrl(endpoint)}?q=${encodeURIComponent(currentMatch.query)}`, { headers: apiHeaders() });
        if (!response.ok) throw new Error(`Mention search returned ${response.status}`);
          if (currentRequest === requestId) render(await response.json(), currentMatch);
      } catch { if (currentRequest === requestId) showMessage('暂时无法加载用户'); }
    }, 80);
  };
  const onKeydown = (event) => {
    if (menu.classList.contains('hidden')) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!items.length) { event.preventDefault(); return; }
      event.preventDefault();
      activeIndex = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      menu.querySelectorAll('.mention-user-item').forEach((button) => {
        const selected = Number(button.dataset.mentionIndex) === activeIndex;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', String(selected));
      });
      menu.querySelector('.mention-user-item.is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(items[activeIndex]);
    } else if (event.key === 'Escape') hide();
  };
  const onDocumentClick = (event) => { if (!menu.contains(event.target) && event.target !== textarea) hide(); };
  const onWindowChange = () => position();
  textarea.addEventListener('input', update);
  textarea.addEventListener('click', update);
  textarea.addEventListener('keyup', update);
  textarea.addEventListener('keydown', onKeydown);
  textarea.addEventListener('scroll', onWindowChange);
  document.addEventListener('click', onDocumentClick);
  window.addEventListener('resize', onWindowChange);
  window.addEventListener('scroll', onWindowChange, true);
  return () => {
    requestId += 1;
    window.clearTimeout(timer);
    textarea.removeEventListener('input', update);
    textarea.removeEventListener('click', update);
    textarea.removeEventListener('keyup', update);
    textarea.removeEventListener('keydown', onKeydown);
    textarea.removeEventListener('scroll', onWindowChange);
    document.removeEventListener('click', onDocumentClick);
    window.removeEventListener('resize', onWindowChange);
    window.removeEventListener('scroll', onWindowChange, true);
    menu.remove();
  };
}

export default function FeedShell() {
  const [user, setUser] = useState(null); const [active, setActive] = useState('Home'); const [tab, setTab] = useState('for_you'); const [posts, setPosts] = useState([]); const [currentCursor, setCurrentCursor] = useState(null); const [isLoadingMore, setIsLoadingMore] = useState(false); const [hasMore, setHasMore] = useState(true); const [query, setQuery] = useState(''); const [search, setSearch] = useState({ users: [], posts: [] }); const [composerOpen, setComposerOpen] = useState(false); const [draft, setDraft] = useState('');
  const feedSentinelRef = useRef(null);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem('aero_user') || 'null'); if (localStorage.getItem('aero_token') && saved) setUser(saved); } catch {} }, []);
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setPosts([]); setCurrentCursor(null); setHasMore(true); setIsLoadingMore(true);
    getFeedPage(tab, user.id, null, 10).then((result) => {
      if (cancelled) return;
      setPosts(result.posts || []); setCurrentCursor(result.next_cursor || null); setHasMore(Boolean(result.has_more)); setIsLoadingMore(false);
    }).catch(() => { if (!cancelled) setIsLoadingMore(false); });
    return () => { cancelled = true; };
  }, [user, tab]);
  useEffect(() => {
    const sentinel = feedSentinelRef.current;
    if (!sentinel || !user) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || !hasMore || isLoadingMore || !currentCursor) return;
      setIsLoadingMore(true);
      getFeedPage(tab, user.id, currentCursor, 10).then((result) => {
        setPosts((current) => [...current, ...(result.posts || []).filter((post) => !current.some((item) => item.id === post.id))]);
        setCurrentCursor(result.next_cursor || null); setHasMore(Boolean(result.has_more));
      }).finally(() => setIsLoadingMore(false));
    }, { rootMargin: '300px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [currentCursor, hasMore, isLoadingMore, tab, user]);
  useEffect(() => {
    if (!composerOpen) return undefined;
    const textarea = Array.from(document.querySelectorAll('.aero-pop textarea')).at(-1);
    return textarea ? installMentionPicker(textarea) : undefined;
  }, [composerOpen]);
  if (!user) return <AuthPanel onAuthenticated={setUser} />;
  const logout = () => { localStorage.removeItem('aero_token'); localStorage.removeItem('aero_user'); setUser(null); };
  const handlePostAction = async (action, post, liked) => {
    if (action !== 'like') return;
    const response = await fetch(getValidUrl(`interact/posts/${post.id}/like`), {
      method: liked ? 'POST' : 'DELETE',
      headers: apiHeaders(),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || 'Unable to update like');
    return result;
  };
  const publish = async (event) => { event.preventDefault(); if (!draft.trim()) return; const response = await fetch(getValidUrl('api/posts'), { method: 'POST', headers: { ...apiHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draft.trim(), images: [] }) }); if (response.ok) { setDraft(''); setComposerOpen(false); const created = await response.json(); setPosts((current) => [created.post || created, ...current]); } };
  const navigate = (label) => { if (label === 'Post') setComposerOpen(true); else if (label === 'Profile') setActive('Profile'); else if (label === 'Home') setActive('Home'); else setActive(label); };
  return <><div className="aero-bg" aria-hidden="true"><span className="aero-glow aero-glow-one" /><span className="aero-glow aero-glow-two" /><span className="aero-glow aero-glow-three" /></div><Header user={user} onSearch={setQuery} onProfile={() => setActive('Profile')} onLogout={logout} /><Sidebar active={active} onNavigate={navigate} /><div className="mx-auto flex max-w-[1200px] justify-center gap-6 px-3 pb-24 pt-[100px] md:px-0"><main className="w-full max-w-[620px]">{active === 'Home' ? <><div className="relative mb-3 flex items-center gap-3 border-b-0 px-2 pt-1"><button onClick={() => setTab('for_you')} className={`border-b-[3px] px-0 pb-2 text-[.82rem] font-bold ${tab === 'for_you' ? 'border-[#0A84FF] text-[#1c1e21]' : 'border-transparent text-[#65676b]'}`}>For You</button><button onClick={() => setTab('following')} className={`border-b-[3px] px-0 pb-2 text-[.82rem] font-bold ${tab === 'following' ? 'border-[#0A84FF] text-[#1c1e21]' : 'border-transparent text-[#65676b]'}`}>Following</button>{query && <UserSearchModal query={query} users={search.users} posts={search.posts} onClose={() => setQuery('')} />}</div><button onClick={() => setComposerOpen(true)} className="mb-6 flex min-h-[72px] w-full items-center justify-between gap-4 rounded-3xl border border-white/60 bg-white/65 p-4 text-left text-[#65676b] shadow-glass backdrop-blur-2xl transition-transform duration-200 hover:-translate-y-0.5"><span className="flex min-w-0 items-center gap-3"><Avatar user={user} className="h-9 w-9 text-sm" /><span className="truncate">Share what's on your mind...</span></span><span className="hidden items-center gap-1 text-sm text-[#0A84FF] sm:flex"><Icon name="image" className="h-[18px] w-[18px]" />Add media</span></button>{posts.length ? posts.map((post) => <PostCard key={post.id} post={post} />) : <Glass className="rounded-[20px] p-8 text-center text-[#65676b]">No posts found</Glass>}<div ref={feedSentinelRef} id="feed-sentinel" className={`feed-sentinel ${isLoadingMore ? 'is-loading' : ''}`} aria-hidden={!isLoadingMore}>{isLoadingMore && <span className="loading-spinner" aria-label="Loading more posts" />}</div></> : <Glass className="rounded-[20px] p-8"><h1 className="mb-2 text-2xl font-bold">{active}</h1><p className="text-[#65676b]">This view keeps the original Aero navigation ready for its API-backed module.</p></Glass>}</main></div>{composerOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-md"><Glass className="aero-pop w-full max-w-[620px] rounded-[20px] p-5"><form onSubmit={publish}><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><Avatar user={user} /><div><h2 className="font-bold">Create post</h2><span className="text-sm text-[#65676b]">{user.display_name || user.username}</span></div></div><button type="button" onClick={() => setComposerOpen(false)} className="text-2xl text-[#65676b]" aria-label="Close">&times;</button></div><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} className="min-h-40 w-full resize-y rounded-2xl border border-white/70 bg-white/30 p-3 outline-none focus:border-[#0A84FF]" placeholder="Share what's on your mind..." /><div className="mt-4 flex justify-end"><button disabled={!draft.trim()} className="rounded-2xl bg-[#0A84FF] px-5 py-2 font-semibold text-white disabled:opacity-50">Post</button></div></form></Glass></div>}</>;
}
