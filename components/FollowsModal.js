// Followers and following relationship modal
// From: profile user id -> To: /api/users/:id/follows and /api/social/follow/:id
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from './ui';
import { getValidUrl } from '../lib/apiUrl';

const COPY = {
  en: {
    followers: 'Followers', following: 'Following', follow: 'Follow', followBack: 'Follow back',
    followed: 'Following', close: 'Close', loading: 'Loading people...', empty: 'No people to show yet.',
    failed: 'Unable to load this list.', unfollowTitle: 'Remove following', followTitle: 'Follow user',
  },
  zh: {
    followers: '粉丝', following: '已关注', follow: '关注', followBack: '回关',
    followed: '已关注', close: '关闭', loading: '正在加载…', empty: '暂时没有用户。',
    failed: '无法加载列表。', unfollowTitle: '取消关注', followTitle: '关注用户',
  },
};

export default function FollowsModal({
  isOpen,
  onClose,
  initialTab = 'followers',
  userId,
  followersCount = 0,
  followingCount = 0,
  onCountsChange,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ followers: followersCount, following: followingCount });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingUserId, setPendingUserId] = useState(null);
  const [language, setLanguage] = useState('en');
  const [viewerId, setViewerId] = useState(0);
  const copy = COPY[language];

  useEffect(() => {
    const handleLanguageChange = () => {
      setLanguage(String(document.documentElement.lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
    };
    window.addEventListener('aero:language-change', handleLanguageChange);
    return () => window.removeEventListener('aero:language-change', handleLanguageChange);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab === 'following' ? 'following' : 'followers');
    setCounts({ followers: Number(followersCount) || 0, following: Number(followingCount) || 0 });
    setLanguage(String(document.documentElement.lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
    try {
      const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
      setViewerId(Number(currentUser.id || currentUser.user_id || 0));
    } catch {
      setViewerId(0);
    }
  }, [isOpen, initialTab, followersCount, followingCount]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !userId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const token = localStorage.getItem('aero_token') || '';
    fetch(getValidUrl(`api/users/${encodeURIComponent(userId)}/follows?type=${activeTab}`), {
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || copy.failed);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setCounts({ followers: Number(data.followers_count) || 0, following: Number(data.following_count) || 0 });
    }).catch((requestError) => {
      if (requestError.name !== 'AbortError') setError(requestError.message || copy.failed);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [isOpen, userId, activeTab, copy.failed]);

  async function toggleRelationship(user) {
    const token = localStorage.getItem('aero_token');
    if (!token) {
      window.showLoginModal?.('Please sign in before following people.');
      return;
    }
    setPendingUserId(user.id);
    try {
      const response = await fetch(getValidUrl(`api/social/follow/${encodeURIComponent(user.id)}`), {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || copy.failed);
      setUsers((current) => {
        if (Number(userId) === viewerId && activeTab === 'following' && !result.is_following) {
          return current.filter((item) => Number(item.id) !== Number(user.id));
        }
        return current.map((item) => Number(item.id) === Number(user.id)
          ? { ...item, is_following: Boolean(result.is_following) }
          : item);
      });
      if (Number(userId) === viewerId) {
        setCounts((current) => {
          const next = { ...current, following: Math.max(0, current.following + (result.is_following ? 1 : -1)) };
          onCountsChange?.(next);
          return next;
        });
      }
    } catch (requestError) {
      setError(requestError.message || copy.failed);
    } finally {
      setPendingUserId(null);
    }
  }

  if (!isOpen) return null;

  return <div className="follows-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="follows-modal-panel" role="dialog" aria-modal="true" aria-label={`${copy.followers} / ${copy.following}`}>
      <button type="button" className="follows-modal-close" aria-label={copy.close} onClick={onClose}>×</button>
      <div className="follows-modal-tabs" role="tablist">
        {['followers', 'following'].map((tab) => <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          className={activeTab === tab ? 'is-active' : ''}
          onClick={() => setActiveTab(tab)}
        ><span data-i18n={tab === 'followers' ? 'Followers' : 'Following'}>{copy[tab]}</span> <span>{counts[tab]}</span></button>)}
      </div>
      <div className="follows-modal-list" role="tabpanel" aria-busy={loading}>
        {loading ? <p className="follows-modal-state">{copy.loading}</p>
          : error ? <p className="follows-modal-state is-error">{error}</p>
            : users.length === 0 ? <p className="follows-modal-state">{copy.empty}</p>
              : users.map((user) => {
                const isFollowing = Boolean(user.is_following);
                const label = isFollowing ? copy.followed : (activeTab === 'followers' && user.is_followed_by ? copy.followBack : copy.follow);
                return <div className="follows-modal-user" key={user.id}>
                  <Link href={`/profile/${encodeURIComponent(user.username)}`} className="follows-modal-user-link" onClick={onClose}>
                    <Avatar user={user} className="follows-modal-avatar" />
                    <span className="follows-modal-user-copy"><strong>@{user.username}</strong><small>{user.display_name || user.username}</small></span>
                  </Link>
                  {Number(user.id) !== viewerId && <button
                    type="button"
                    className={`follows-modal-action ${isFollowing ? 'is-following' : ''}`}
                    title={isFollowing ? copy.unfollowTitle : copy.followTitle}
                    disabled={Number(pendingUserId) === Number(user.id)}
                    onClick={() => toggleRelationship(user)}
                  ><span data-i18n={isFollowing ? 'Following' : label === copy.followBack ? 'Follow back' : 'Follow'}>{Number(pendingUserId) === Number(user.id) ? '…' : label}</span></button>}
                </div>;
              })}
      </div>
    </section>
  </div>;
}