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

const composerTranslations = {
  en: {
    cancel: 'Cancel', new_thread: 'New Thread', post: 'Post', reply_anyone: 'Anyone can reply', add_to_thread: 'Add to thread',
    drafts: 'Drafts', more_options: 'More options', topic_profile: 'Your profile', topic_technology: 'Technology', topic_design: 'Design', topic_community: 'Community',
    write_something: 'Write something...', remove_thread: 'Remove thread post', attachment: 'Attachment', remove_attachment: 'Remove attachment',
    image_or_video: 'Image or video', gif_animation: 'GIF', emoji: 'Emoji', voice_input: 'Voice input', poll: 'Poll', quote: 'Quote', location: 'Location', audio: 'Audio',
    post_options: 'Post options', who_can_reply: 'Who can reply and quote', reply_followers: 'Your followers', reply_following: 'Profiles you follow', reply_mentioned: 'Profiles you mention',
    review_replies: 'Review and approve replies', share_to: 'Also share to...', dont_share: 'Don’t share', facebook: 'Facebook', instagram: 'Instagram',
    select_publish_time: 'Schedule post...', complete: 'Done', recommended_tags: 'Add suggested tag', scheduled_post: 'Schedule', no_drafts: 'No drafts yet', unnamed_draft: 'Untitled draft',
    selected_gif: 'Selected GIF', remove_gif: 'Remove GIF', choose_topic: 'Choose community or topic', post_attachments: 'Post attachments and tools',
    unsupported_voice: 'Voice input is not supported in this browser.', unsupported_audio: 'Audio attachments are not available yet.', unable_upload: 'Unable to upload media', unable_publish: 'Unable to publish post',
    device_location: 'This device cannot provide a location.', location_failed: 'Unable to get your location.', remove_thread_post: 'Remove thread post',
  },
  zh: {
    cancel: '取消', new_thread: '新建帖子', post: '发布', reply_anyone: '任何人', add_to_thread: '添加到串文',
    drafts: '草稿箱', more_options: '更多选项', topic_profile: '个人主页', topic_technology: '科技', topic_design: '设计', topic_community: '社群',
    write_something: '写点什么...', remove_thread: '删除串文', attachment: '附件', remove_attachment: '移除附件',
    image_or_video: '图片或视频', gif_animation: 'GIF 动画', emoji: '表情', voice_input: '语音输入', poll: '投票', quote: '引用', location: '位置', audio: '音频',
    post_options: '帖子选项', who_can_reply: '谁能回复和引用', reply_followers: '你的粉丝', reply_following: '你关注的主页', reply_mentioned: '你提及的主页',
    review_replies: '审核并批准回复', share_to: '同时分享到...', dont_share: '不分享', facebook: 'Facebook', instagram: 'Instagram',
    select_publish_time: '预设发布时间...', complete: '完成', recommended_tags: '添加推荐标签', scheduled_post: '定时发布', no_drafts: '还没有草稿', unnamed_draft: '未命名草稿',
    selected_gif: '所选 GIF', remove_gif: '移除 GIF', choose_topic: '选择社群或话题', post_attachments: '帖子附件和工具',
    unsupported_voice: '此浏览器暂不支持语音输入。', unsupported_audio: '音频附件暂不可用。', unable_upload: '无法上传媒体', unable_publish: '无法发布帖子',
    device_location: '此设备无法获取位置。', location_failed: '无法获取位置。', remove_thread_post: '删除串文',
  },
};

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
    const children = [];
    if (match?.kind === 'hashtag' && !match.query) {
      const header = document.createElement('div');
      header.className = 'mention-section-header';
      header.textContent = '热门标签';
      children.push(header);
    }
    children.push(status);
    menu.replaceChildren(...children);
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
      if (!currentMatch.query) {
        const header = document.createElement('div');
        header.className = 'mention-section-header';
        header.textContent = '热门标签';
        menu.appendChild(header);
      }
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
    showMessage(kind === 'hashtag' ? '正在寻找标签...' : '正在寻找用户...');
    const currentMatch = match;
    window.clearTimeout(timer);
    const currentRequest = ++requestId;
    timer = window.setTimeout(async () => {
      try {
          const endpoint = currentMatch.kind === 'mention' ? 'api/users/search-mention' : 'api/hashtags/search';
          const response = await fetch(`${getValidUrl(endpoint)}?q=${encodeURIComponent(currentMatch.query)}`, { headers: apiHeaders() });
        if (!response.ok) throw new Error(`Mention search returned ${response.status}`);
          if (currentRequest === requestId) render(await response.json(), currentMatch);
      } catch { if (currentRequest === requestId) showMessage(currentMatch.kind === 'hashtag' ? '暂时无法加载标签' : '暂时无法加载用户'); }
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
  const [threadPosts, setThreadPosts] = useState([{ id: 1, content: '', files: [] }]);
  const [composerView, setComposerView] = useState('compose');
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [composerMenu, setComposerMenu] = useState('');
  const [replyPermission, setReplyPermission] = useState('everyone');
  const [reviewReplies, setReviewReplies] = useState(false);
  const [shareTo, setShareTo] = useState('none');
  const [topic, setTopic] = useState('profile');
  const [scheduledAt, setScheduledAt] = useState('');
  const [selectedGif, setSelectedGif] = useState('');
  const [composerError, setComposerError] = useState('');
  const [language, setLanguage] = useState('en');
  const uploadInputRef = useRef(null);
  const feedSentinelRef = useRef(null);
  const t = (key) => (typeof window !== 'undefined' && window.AeroI18n?.t(key)) || composerTranslations[language][key] || key;
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem('aero_user') || 'null'); if (localStorage.getItem('aero_token') && saved) setUser(saved); } catch {} }, []);
  useEffect(() => {
    const syncLanguage = (event) => setLanguage(event.detail?.language || window.AeroI18n?.getLanguage?.() || localStorage.getItem('aero_user_lang') || localStorage.getItem('aero_language') || 'en');
    syncLanguage({});
    window.addEventListener('aero:language-change', syncLanguage);
    return () => window.removeEventListener('aero:language-change', syncLanguage);
  }, []);
  useEffect(() => { try { setSavedDrafts(JSON.parse(localStorage.getItem('aero_post_drafts') || '[]')); } catch { setSavedDrafts([]); } }, []);
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
    const textarea = document.querySelector('.threads-post-content textarea');
    return textarea ? installMentionPicker(textarea) : undefined;
  }, [composerOpen]);
  useEffect(() => {
    if (!composerMenu || composerMenu.endsWith('-closing')) return undefined;
    const handleClickOutside = (event) => {
      if (event.target.closest('.threads-dropdown-menu, .threads-dropdown-trigger, .threads-compose-toolbar')) return;
      setComposerMenu((current) => current ? `${current}-closing` : current);
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setComposerMenu((current) => current ? `${current}-closing` : current);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [composerMenu]);
  useEffect(() => {
    if (!composerMenu.endsWith('-closing')) return undefined;
    const closeTimer = window.setTimeout(() => setComposerMenu(''), 160);
    return () => window.clearTimeout(closeTimer);
  }, [composerMenu]);
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
  const updateThreadPost = (index, changes) => setThreadPosts((current) => current.map((post, postIndex) => postIndex === index ? { ...post, ...changes } : post));
  const appendToPost = (index, text) => updateThreadPost(index, { content: `${threadPosts[index].content}${text}` });
  const addThreadPost = () => {
    if (threadPosts.length >= 10) return;
    setThreadPosts((current) => [...current, { id: Date.now(), content: '', files: [] }]);
  };
  const isComposerMenuOpen = (menu) => composerMenu === menu || composerMenu === `${menu}-closing`;
  const toggleComposerMenu = (menu) => {
    setComposerMenu((current) => current === menu ? `${menu}-closing` : menu);
  };
  const persistDrafts = (nextDrafts) => {
    setSavedDrafts(nextDrafts);
    localStorage.setItem('aero_post_drafts', JSON.stringify(nextDrafts));
  };
  const closeComposer = (save = false) => {
    if (save && threadPosts.some((post) => post.content.trim() || post.files.length)) {
      persistDrafts([{ id: Date.now(), posts: threadPosts.map(({ content }) => ({ content })), topic, updatedAt: new Date().toISOString() }, ...savedDrafts]);
    }
    setComposerOpen(false);
    setComposerView('compose');
    setComposerMenu('');
  };
  const loadDraft = (saved) => {
    setThreadPosts(saved.posts.map((post, index) => ({ id: Date.now() + index, content: post.content || '', files: [] })));
    setTopic(saved.topic || 'profile');
    setComposerView('compose');
  };
  const uploadPostMedia = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(getValidUrl('api/uploads'), { method: 'POST', headers: apiHeaders(), body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Unable to upload media');
    return payload.url;
  };
  const publish = async (event) => {
    event.preventDefault();
    const entries = threadPosts.filter((post) => post.content.trim() || post.files.length || (post === threadPosts[0] && selectedGif));
    if (!entries.length) return;
    setComposerError('');
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const payloadPosts = await Promise.all(entries.map(async (post) => ({
        content: post.content.trim(),
        images: [...await Promise.all(post.files.map(uploadPostMedia)), ...(post === threadPosts[0] && selectedGif ? [selectedGif] : [])],
      })));
      const body = {
        posts: payloadPosts,
        scheduled_at: scheduledAt || null,
        reply_permission: replyPermission,
        review_replies: reviewReplies,
        share_to: shareTo,
        topic,
      };
      const endpoint = payloadPosts.length > 1 ? 'api/posts/chain' : 'api/posts';
      const requestBody = payloadPosts.length > 1 ? body : { ...payloadPosts[0], ...body };
      const response = await fetch(getValidUrl(endpoint), {
        method: 'POST',
        headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to publish post');
      const createdPosts = result.posts || [result.post || result];
      setPosts((current) => [...createdPosts, ...current]);
      setThreadPosts([{ id: Date.now(), content: '', files: [] }]);
      setSelectedGif('');
      setScheduledAt('');
      setComposerOpen(false);
      setComposerView('compose');
    } catch (error) {
      setComposerError(error.message || 'Unable to publish post');
    } finally {
      button.disabled = false;
    }
  };
  const topicOptions = [
    ['profile', 'topic_profile'], ['technology', 'topic_technology'], ['design', 'topic_design'], ['community', 'topic_community'],
  ];
  const topicLabel = topicOptions.find(([value]) => value === topic)?.[1] || 'topic_profile';
  const replyOptions = [
    ['everyone', 'reply_anyone'], ['followers', 'reply_followers'], ['following', 'reply_following'], ['mentioned', 'reply_mentioned'],
  ];
  const replyLabel = replyOptions.find(([value]) => value === replyPermission)?.[1] || 'reply_anyone';
  const navigate = (label) => { if (label === 'Post') setComposerOpen(true); else if (label === 'Profile') setActive('Profile'); else if (label === 'Home') setActive('Home'); else setActive(label); };
  return (
    <>
      <div className="aero-bg" aria-hidden="true"><span className="aero-glow aero-glow-one" /><span className="aero-glow aero-glow-two" /><span className="aero-glow aero-glow-three" /></div>
      <Header user={user} onSearch={setQuery} onProfile={() => setActive('Profile')} onLogout={logout} />
      <Sidebar active={active} onNavigate={navigate} />
      <div className="mx-auto flex max-w-[1200px] justify-center gap-6 px-3 pb-24 pt-[100px] md:px-0">
        <main className="w-full max-w-[620px]">
          {active === 'Home' ? <>
            <div className="relative mb-3 flex items-center gap-3 border-b-0 px-2 pt-1">
              <button onClick={() => setTab('for_you')} className={`border-b-[3px] px-0 pb-2 text-[.82rem] font-bold ${tab === 'for_you' ? 'border-[#0A84FF] text-[#1c1e21]' : 'border-transparent text-[#65676b]'}`}>For You</button>
              <button onClick={() => setTab('following')} className={`border-b-[3px] px-0 pb-2 text-[.82rem] font-bold ${tab === 'following' ? 'border-[#0A84FF] text-[#1c1e21]' : 'border-transparent text-[#65676b]'}`}>Following</button>
              {query && <UserSearchModal query={query} users={search.users} posts={search.posts} onClose={() => setQuery('')} />}
            </div>
            <button onClick={() => setComposerOpen(true)} className="mb-6 flex min-h-[72px] w-full items-center justify-between gap-4 rounded-3xl border border-white/60 bg-white/65 p-4 text-left text-[#65676b] shadow-glass backdrop-blur-2xl transition-transform duration-200 hover:-translate-y-0.5">
              <span className="flex min-w-0 items-center gap-3"><Avatar user={user} className="h-9 w-9 text-sm" /><span className="truncate">Share what's on your mind...</span></span>
              <span className="hidden items-center gap-1 text-sm text-[#0A84FF] sm:flex"><Icon name="image" className="h-[18px] w-[18px]" />Add media</span>
            </button>
            {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} />) : <Glass className="rounded-[20px] p-8 text-center text-[#65676b]">No posts found</Glass>}
            <div ref={feedSentinelRef} id="feed-sentinel" className={`feed-sentinel ${isLoadingMore ? 'is-loading' : ''}`} aria-hidden={!isLoadingMore}>{isLoadingMore && <span className="loading-spinner" aria-label="Loading more posts" />}</div>
          </> : <Glass className="rounded-[20px] p-8"><h1 className="mb-2 text-2xl font-bold">{active}</h1><p className="text-[#65676b]">This view keeps the original Aero navigation ready for its API-backed module.</p></Glass>}
        </main>
      </div>
      {composerOpen && <div className="threads-compose-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeComposer(true); }}>
        <section className="threads-compose-modal" role="dialog" aria-modal="true" aria-labelledby="threads-compose-title">
          <header className="threads-compose-header">
            <button type="button" className="threads-text-button" onClick={() => closeComposer(true)}>{t('cancel')}</button>
            <h2 id="threads-compose-title">{composerView === 'drafts' ? t('drafts') : t('new_thread')}</h2>
            <div className="threads-header-actions">
              <button type="button" className="threads-icon-button" aria-label={t('drafts')} title={t('drafts')} onClick={() => { setComposerView(composerView === 'drafts' ? 'compose' : 'drafts'); setComposerMenu(''); }}><Icon name="draft" className="threads-header-icon" /></button>
              <div className="threads-menu-anchor">
                <button type="button" className="threads-icon-button threads-more-button threads-dropdown-trigger" aria-label={t('more_options')} title={t('more_options')} onClick={() => toggleComposerMenu('more')}><Icon name="more" className="threads-header-icon" /></button>
                {isComposerMenuOpen('more') && <div className={`threads-dropdown-menu threads-more-menu${composerMenu.endsWith('-closing') ? ' is-closing' : ''}`}>
                  <button type="button" onClick={() => { appendToPost(0, `${threadPosts[0].content.trim() ? ' ' : ''}#Aero`); setComposerMenu(''); }}>{t('recommended_tags')}</button>
                  <button type="button" onClick={() => setComposerMenu('schedule')}>{t('select_publish_time')}</button>
                </div>}
                {isComposerMenuOpen('schedule') && <div className={`threads-dropdown-menu threads-schedule-menu${composerMenu.endsWith('-closing') ? ' is-closing' : ''}`}><label htmlFor="threads-schedule">{t('select_publish_time')}</label><input id="threads-schedule" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /><button type="button" onClick={() => setComposerMenu('')}>{t('complete')}</button></div>}
              </div>
            </div>
          </header>
          {composerView === 'drafts' ? <div className="threads-drafts-view">
            {savedDrafts.length ? savedDrafts.map((saved) => <button type="button" className="threads-draft-item" key={saved.id} onClick={() => loadDraft(saved)}><span>{saved.posts.map((post) => post.content).filter(Boolean).join(' · ') || t('unnamed_draft')}</span><time>{new Date(saved.updatedAt).toLocaleDateString()}</time></button>) : <div className="threads-drafts-empty"><span aria-hidden="true"><Icon name="draft" className="threads-empty-icon" /></span><strong>{t('no_drafts')}</strong></div>}
          </div> : <form className="threads-compose-form" onSubmit={publish}>
            <div className="threads-compose-body">
              <div className="threads-author-row">
                <Avatar user={user} className="threads-compose-avatar" />
                <strong>{user.username || user.display_name || 'User'}</strong>
                <span className="threads-chevron">›</span>
                <div className="threads-menu-anchor threads-topic-anchor">
                  <button type="button" className="threads-dropdown-trigger threads-topic-trigger" aria-label={t('choose_topic')} aria-expanded={isComposerMenuOpen('topic')} onClick={() => toggleComposerMenu('topic')}>{t(topicLabel)}<Icon name="chevron" className="threads-chevron-icon" /></button>
                  {isComposerMenuOpen('topic') && <div className={`threads-dropdown-menu threads-topic-menu${composerMenu.endsWith('-closing') ? ' is-closing' : ''}`} role="listbox" aria-label={t('choose_topic')}>
                    {topicOptions.map(([value, label]) => <button type="button" role="option" aria-selected={topic === value} key={value} onClick={() => { setTopic(value); setComposerMenu(''); }}>{t(label)}{topic === value && <Icon name="check" className="threads-option-check" />}</button>)}
                  </div>}
                </div>
                {threadPosts.length > 1 && <span className="threads-chain-count">1/{threadPosts.length}</span>}
              </div>
              <div className="threads-post-list">
                {threadPosts.map((post, index) => <div className={`threads-post-row${index ? ' is-thread-reply' : ''}`} key={post.id}>
                  <div className="threads-post-rail">
                    {index > 0 && <Avatar user={user} className="threads-compose-avatar" />}
                    {threadPosts.length > 1 && index < threadPosts.length - 1 && <span className="threads-thread-line" />}
                  </div>
                  <div className="threads-post-content">
                    {index > 0 && <div className="threads-post-byline"><strong>{user.username || user.display_name || 'User'}</strong><span>{index + 1}/{threadPosts.length}</span><button type="button" className="threads-remove-post" aria-label={t('remove_thread')} onClick={() => setThreadPosts((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>}
                    <textarea autoFocus={index === 0} value={post.content} maxLength={5000} placeholder={t('write_something')} aria-label={`${t('add_to_thread')} ${index + 1}`} onChange={(event) => updateThreadPost(index, { content: event.target.value })} />
                    {post.files.length > 0 && <div className="threads-upload-list">{post.files.map((file, fileIndex) => <span key={`${file.name}-${fileIndex}`}>{file.name}<button type="button" aria-label={t('remove_attachment')} onClick={() => updateThreadPost(index, { files: post.files.filter((_, itemIndex) => itemIndex !== fileIndex) })}>×</button></span>)}</div>}
                  </div>
                </div>)}
              </div>
              {selectedGif && <div className="threads-gif-preview"><img src={selectedGif} alt={t('selected_gif')} /><button type="button" aria-label={t('remove_gif')} onClick={() => setSelectedGif('')}>×</button></div>}
              <div className="threads-compose-toolbar" aria-label={t('post_attachments')}>
                <button type="button" title={t('image_or_video')} aria-label={t('image_or_video')} onClick={() => uploadInputRef.current?.click()}><Icon name="image" /></button>
                <button type="button" className="threads-gif-trigger threads-dropdown-trigger" title={t('gif_animation')} aria-label={t('gif_animation')} aria-expanded={isComposerMenuOpen('gif')} onClick={() => toggleComposerMenu('gif')}><Icon name="gif" /></button>
                <button type="button" title={t('emoji')} aria-label={t('emoji')} onClick={() => appendToPost(0, ' 😊')}><Icon name="smile" /></button>
                <button type="button" title={t('voice_input')} aria-label={t('voice_input')} onClick={() => setComposerError(t('unsupported_voice'))}><Icon name="mic" /></button>
                <button type="button" title={t('poll')} aria-label={t('poll')} onClick={() => appendToPost(0, `${threadPosts[0].content.trim() ? '\n' : ''}${t('poll')}: `)}><Icon name="poll" /></button>
                <button type="button" title={t('quote')} aria-label={t('quote')} onClick={() => appendToPost(0, '“”')}><Icon name="quote" /></button>
                <button type="button" title={t('location')} aria-label={t('location')} onClick={() => { if (!navigator.geolocation) setComposerError(t('device_location')); else navigator.geolocation.getCurrentPosition(({ coords }) => appendToPost(0, ` ${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`), () => setComposerError(t('location_failed'))); }}><Icon name="pin" /></button>
                <button type="button" title={t('audio')} aria-label={t('audio')} onClick={() => setComposerError(t('unsupported_audio'))}><Icon name="audio" /></button>
                <input ref={uploadInputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(event) => { const files = [...threadPosts[0].files, ...Array.from(event.target.files || [])].slice(0, 10); updateThreadPost(0, { files }); event.target.value = ''; }} />
              </div>
              {isComposerMenuOpen('gif') && <div className={`threads-gif-picker threads-dropdown-menu${composerMenu.endsWith('-closing') ? ' is-closing' : ''}`}>{['https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif', 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif'].map((url) => <button type="button" key={url} onClick={() => { setSelectedGif(url); setComposerMenu(''); }}><img src={url} alt={t('select_gif')} /></button>)}</div>}
              {composerError && <p className="threads-compose-error" role="status">{composerError}</p>}
            </div>
            <footer className="threads-compose-footer">
              <div className="threads-compose-footer-left">
                <div className="threads-menu-anchor">
                  <button type="button" className="threads-footer-menu-button threads-dropdown-trigger" aria-expanded={isComposerMenuOpen('options')} onClick={() => toggleComposerMenu('options')}><Icon name="options" />{t('post_options')}</button>
                  {isComposerMenuOpen('options') && <div className={`threads-dropdown-menu threads-options-menu${composerMenu.endsWith('-closing') ? ' is-closing' : ''}`}>
                    <div className="threads-option-group"><strong>{t('who_can_reply')}</strong><button type="button" className="threads-option-trigger threads-dropdown-trigger" aria-expanded={isComposerMenuOpen('reply')} onClick={() => toggleComposerMenu('reply')}>{t(replyLabel)}<Icon name="chevron" className="threads-chevron-icon" /></button>
                      {isComposerMenuOpen('reply') && <div className={`threads-dropdown-menu threads-reply-menu${composerMenu.endsWith('-closing') ? ' is-closing' : ''}`} role="listbox" aria-label={t('who_can_reply')}>
                        {replyOptions.map(([value, label]) => <button type="button" role="option" aria-selected={replyPermission === value} key={value} onClick={() => { setReplyPermission(value); setComposerMenu('options'); }}>{t(label)}{replyPermission === value && <Icon name="check" className="threads-option-check" />}</button>)}
                      </div>}
                    </div>
                    <label className="threads-toggle-row">{t('review_replies')}<input type="checkbox" checked={reviewReplies} onChange={(event) => setReviewReplies(event.target.checked)} /><span className="threads-toggle" /></label>
                    <div className="threads-option-group"><strong>{t('share_to')}</strong><button type="button" className="threads-option-trigger threads-dropdown-trigger" aria-expanded={isComposerMenuOpen('share')} onClick={() => toggleComposerMenu('share')}>{t(shareTo === 'none' ? 'dont_share' : shareTo)}<Icon name="chevron" className="threads-chevron-icon" /></button>
                      {isComposerMenuOpen('share') && <div className={`threads-dropdown-menu threads-share-menu${composerMenu.endsWith('-closing') ? ' is-closing' : ''}`} role="listbox" aria-label={t('share_to')}>
                        {[['none', 'dont_share'], ['facebook', 'facebook'], ['instagram', 'instagram']].map(([value, label]) => <button type="button" role="option" aria-selected={shareTo === value} key={value} onClick={() => { setShareTo(value); setComposerMenu('options'); }}>{t(label)}{shareTo === value && <Icon name="check" className="threads-option-check" />}</button>)}
                      </div>}
                    </div>
                  </div>}
                </div>
                <button type="button" className="threads-add-post-button" onClick={addThreadPost} disabled={threadPosts.length >= 10}><Icon name="plus" />{t('add_to_thread')}</button>
              </div>
              <button type="submit" className="threads-publish-button" disabled={!threadPosts.some((post) => post.content.trim() || post.files.length) && !selectedGif}>{scheduledAt ? t('scheduled_post') : t('post')}</button>
            </footer>
          </form>}
        </section>
      </div>}
    </>
  );
}
