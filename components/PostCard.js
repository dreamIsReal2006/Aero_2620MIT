'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, Glass, Icon } from './ui';
import { getValidUrl } from '../lib/apiUrl';

let mentionDirectoryPromise;

function loadMentionDirectory() {
  if (!mentionDirectoryPromise) {
    mentionDirectoryPromise = fetch(getValidUrl('api/users/mention-directory'), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('aero_token') || ''}` },
    }).then((response) => response.ok ? response.json() : { users: [] })
      .then((payload) => Array.isArray(payload.users) ? payload.users : [])
      .catch(() => []);
  }
  return mentionDirectoryPromise;
}

function renderTaggedContent(content, users) {
  const text = String(content || '');
  const parts = [];
  let cursor = 0;
  const usernames = [...new Set(users.map((user) => String(user.username || '')).filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .map((username) => username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const mentionPattern = usernames.length
    ? `(^|[^A-Za-z0-9_])@(${usernames.join('|')})(?![A-Za-z0-9_])`
    : `(^|[^A-Za-z0-9_])@((?!))`;
  const inlineTagPattern = new RegExp(`${mentionPattern}|(^|[\\s([{])#([\\p{L}\\p{N}_][\\p{L}\\p{N}_.-]{0,99})|📍\\s*(-?\\d+(?:\\.\\d+)?\\s*,\\s*-?\\d+(?:\\.\\d+)?|[^,\\n]+(?:,\\s*[^,\\n]+)?)`, 'giu');
  for (const match of text.matchAll(inlineTagPattern)) {
    const [whole, mentionPrefix, username, hashtagPrefix, hashtag, locationText] = match;
    const prefix = mentionPrefix ?? hashtagPrefix ?? '';
    const linkStart = match.index + prefix.length;
    if (linkStart > cursor) parts.push(text.slice(cursor, linkStart));
    if (locationText !== undefined) {
      const location = locationText.trim();
      parts.push(<a key={`location-${match.index}`} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noopener noreferrer" className="post-location-link" onClick={(event) => event.stopPropagation()}>📍 {location}</a>);
    } else if (username) {
      parts.push(<a key={`mention-${match.index}`} href={`/profile/${encodeURIComponent(username)}`} className="mention-link" data-username={username} onClick={(event) => event.stopPropagation()}>@{username}</a>);
    } else {
      parts.push(<a key={`hashtag-${match.index}`} href={`/hashtag/${encodeURIComponent(hashtag)}`} className="hashtag-link" onClick={(event) => event.stopPropagation()}>#{hashtag}</a>);
    }
    cursor = match.index + whole.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function pollTimeRemaining(expiresAt, now) {
  const seconds = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000));
  const isChinese = typeof window !== 'undefined' && window.AeroI18n?.getLanguage?.() === 'zh';
  if (!seconds) return isChinese ? '投票已结束' : 'Voting ended';
  if (seconds >= 86400) return isChinese
    ? `剩余 ${Math.floor(seconds / 86400)}天 ${Math.floor((seconds % 86400) / 3600)}小时`
    : `Ends in ${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  if (seconds >= 3600) return isChinese
    ? `剩余 ${Math.floor(seconds / 3600)}小时 ${Math.floor((seconds % 3600) / 60)}分钟`
    : `Ends in ${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return isChinese ? `剩余 ${Math.max(1, Math.floor(seconds / 60))}分钟` : `Ends in ${Math.max(1, Math.floor(seconds / 60))}m`;
}

export default function PostCard({ post, onAction }) {
  const [mentionUsers, setMentionUsers] = useState([]);
  const [liked, setLiked] = useState(Boolean(post.is_liked));
  const [likesCount, setLikesCount] = useState(Number(post.likes_count || 0));
  const [bookmarked, setBookmarked] = useState(Boolean(post.is_bookmarked));
  const [poll, setPoll] = useState(post.poll || null);
  const [pollError, setPollError] = useState('');
  const [votingOption, setVotingOption] = useState(null);
  const [pollNow, setPollNow] = useState(Date.now());
  const [viewerIndex, setViewerIndex] = useState(null);
  const touchStartX = useRef(null);
  const author = post.author || post.user || { username: post.username, avatar_url: post.avatar_url };
  const media = post.images || post.media || [];
  const mediaUrl = (item) => String(item).startsWith('http') ? item : `${process.env.NEXT_PUBLIC_API_ORIGIN || ''}${item}`;
  const isVideo = (item) => /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(String(item));

  useEffect(() => {
    if (!poll?.expires_at) return undefined;
    const timer = window.setInterval(() => setPollNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [poll?.expires_at]);

  useEffect(() => {
    let active = true;
    loadMentionDirectory().then((users) => { if (active) setMentionUsers(users); });
    return () => { active = false; };
  }, []);

  const submitPollVote = async (optionIndex) => {
    if (!poll || votingOption !== null || poll.user_voted_option != null || Date.parse(poll.expires_at) <= Date.now()) return;
    setVotingOption(optionIndex);
    setPollError('');
    try {
      const response = await fetch(getValidUrl(`api/posts/${post.id}/vote`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('aero_token') || ''}` },
        body: JSON.stringify({ option_index: optionIndex }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to submit vote');
      setPoll(result.poll);
    } catch (error) {
      setPollError(error.message || 'Unable to submit vote');
    } finally {
      setVotingOption(null);
    }
  };

  const pollOptions = Array.isArray(poll?.options) ? poll.options.map((option) => typeof option === 'string' ? { text: option, votes: 0 } : option) : [];
  const pollTotalVotes = Number(poll?.total_votes || 0);
  const hasVoted = poll?.user_voted_option != null;
  const pollExpired = Boolean(poll?.expired) || Boolean(poll?.expires_at && Date.parse(poll.expires_at) <= pollNow);

  useEffect(() => {
    if (viewerIndex === null) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setViewerIndex(null);
      if (event.key === 'ArrowLeft') setViewerIndex((index) => Math.max(0, index - 1));
      if (event.key === 'ArrowRight') setViewerIndex((index) => Math.min(media.length - 1, index + 1));
    };
    const currentScrollPosition = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.scrollTo(0, currentScrollPosition);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewerIndex, media.length]);

  useEffect(() => {
    const token = localStorage.getItem('aero_token');
    if (!token || !post.id || !('IntersectionObserver' in window)) return undefined;
    let timer;
    let recorded = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !recorded && !timer) {
        timer = window.setTimeout(() => {
          recorded = true;
          fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'https://aero-2620mit.onrender.com/api'}/posts/${post.id}/dwell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ seconds: 3 }),
          }).catch(() => {});
        }, 3000);
      } else if (!entry.isIntersecting && timer) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    }, { threshold: 0.6 });
    const card = document.getElementById(`post-${post.id}`);
    if (!card) return undefined;
    observer.observe(card);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [post.id]);

  return <Glass id={`post-${post.id}`} data-post-id={post.id} className="aero-pop mb-5 rounded-[20px] p-5 transition-transform duration-200 hover:-translate-y-0.5">
    <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><Avatar user={author} /><div className="min-w-0"><strong className="block truncate text-sm">@{author.username || 'User'}</strong><span className="text-xs text-[#65676b]">{post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}</span></div></div><button onClick={() => onAction?.('menu', post)} className="rounded-full px-2 text-lg text-[#65676b] hover:bg-black/5" aria-label="Post options">•••</button></div>
    <p className="mb-4 whitespace-pre-wrap text-[.96rem] leading-6">{renderTaggedContent(post.content || 'Shared a thought with Aero.', mentionUsers)}</p>
    {media.length > 0 && <div className={`post-media-container mb-3 ${media.length > 1 ? 'post-media-carousel' : ''}`}>{media.map((item, index) => { const url = mediaUrl(item); const video = isVideo(item); return video ? <button key={`${item}-${index}`} type="button" className="post-media-item post-video-placeholder" aria-label={`Play video ${index + 1} of ${media.length}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setViewerIndex(index); }}><span className="post-video-placeholder-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span><span className="post-video-placeholder-label">Play video</span></button> : <img key={`${item}-${index}`} src={url} alt="Post media" className="post-media-item" loading="lazy" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setViewerIndex(index); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setViewerIndex(index); } }} tabIndex={0} role="button" aria-label={`Open media ${index + 1} of ${media.length}`} />; })}</div>}
    {poll && pollOptions.length > 0 && <section className="thread-poll-container" aria-label="Post poll">
      {pollOptions.map((option, index) => {
        const votes = Number(option.votes || 0);
        const percentage = pollTotalVotes ? Math.round((votes / pollTotalVotes) * 100) : 0;
        const selected = poll.user_voted_option === index;
        const showResults = hasVoted || pollExpired;
        return <button key={`${index}-${option.text}`} type="button" className={`thread-poll-option${showResults ? ' voted' : ''}${selected ? ' selected' : ''}`} onClick={() => submitPollVote(index)} disabled={hasVoted || pollExpired || votingOption !== null} aria-pressed={selected}>
          {showResults && <span className="poll-progress-fill" style={{ width: `${percentage}%` }} />}
          <span className="poll-option-label">{option.text}</span>
          {showResults && <span className="poll-option-percent">{percentage}%</span>}
          {votingOption === index && <span className="poll-voting-indicator" aria-hidden="true" />}
        </button>;
      })}
      <footer className="thread-poll-footer"><span>{poll?.expires_at ? pollTimeRemaining(poll.expires_at, pollNow) : (typeof window !== 'undefined' && window.AeroI18n?.getLanguage?.() === 'zh' ? '投票进行中' : 'Voting in progress')}</span>{pollTotalVotes > 0 && <span>{typeof window !== 'undefined' && window.AeroI18n?.getLanguage?.() === 'zh' ? `${pollTotalVotes} 人已投票` : `${pollTotalVotes} votes`}</span>}</footer>
      {pollError && <p className="thread-poll-error" role="alert">{pollError}</p>}
    </section>}
    <div className="flex items-center justify-between border-t border-black/10 pt-3"><div className="flex items-center gap-1"><button onClick={() => { const nextLiked = !liked; setLiked(nextLiked); setLikesCount((count) => Math.max(0, count + (nextLiked ? 1 : -1))); Promise.resolve(onAction?.('like', post, nextLiked)).then((result) => { if (Number.isFinite(result?.like_count)) setLikesCount(result.like_count); }).catch(() => { setLiked(!nextLiked); setLikesCount((count) => Math.max(0, count + (nextLiked ? -1 : 1))); }); }} className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-transform active:scale-95 ${liked ? 'text-[#d94b62]' : 'text-[#65676b]'}`} aria-label="Like post"><span className="text-base">♥</span>{likesCount}</button><button onClick={() => onAction?.('comment', post)} className="flex items-center gap-1 rounded-full px-2 py-1 text-sm text-[#65676b] hover:text-[#0A84FF]" aria-label="Comment on post"><Icon name="chat" className="h-[18px] w-[18px]" />{post.comments_count || 0}</button></div><button onClick={() => { setBookmarked(!bookmarked); onAction?.('bookmark', post); }} className={`rounded-full px-2 py-1 text-sm ${bookmarked ? 'text-[#0A84FF]' : 'text-[#65676b]'}`} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark post'}><Icon name="bookmark" className="h-[18px] w-[18px]" /></button></div>
    {viewerIndex !== null && typeof document !== 'undefined' && createPortal(<div className="threads-media-modal" role="dialog" aria-modal="true" aria-label="Media viewer" onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) setViewerIndex(null); }}><button type="button" className="threads-media-close" aria-label="Close media viewer" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setViewerIndex(null); }}>×</button><button type="button" className="threads-media-nav lightbox-nav-btn threads-media-prev lightbox-prev-btn" aria-label="Previous media" hidden={viewerIndex === 0 || media.length < 2} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setViewerIndex((index) => Math.max(0, index - 1)); }}><span className="material-symbols-outlined" aria-hidden="true">arrow_back_ios</span></button><div className="threads-media-stage" onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchStartX.current === null) return; const delta = event.changedTouches[0].clientX - touchStartX.current; touchStartX.current = null; if (Math.abs(delta) > 50) setViewerIndex((index) => Math.min(Math.max(index + (delta < 0 ? 1 : -1), 0), media.length - 1)); }}>{isVideo(media[viewerIndex]) ? <video className="threads-media-content" src={mediaUrl(media[viewerIndex])} controls autoPlay playsInline preload="none" /> : <img className="threads-media-content" src={mediaUrl(media[viewerIndex])} alt="Post media" />}</div><button type="button" className="threads-media-nav lightbox-nav-btn threads-media-next lightbox-next-btn" aria-label="Next media" hidden={viewerIndex === media.length - 1 || media.length < 2} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setViewerIndex((index) => Math.min(media.length - 1, index + 1)); }}><span className="material-symbols-outlined" aria-hidden="true">arrow_forward_ios</span></button><div className="lightbox-pagination-dots" aria-hidden="true" style={{ display: media.length > 1 ? 'flex' : 'none' }}>{media.map((_, index) => <span key={index} className={`lightbox-dot${index === viewerIndex ? ' active' : ''}`} />)}</div></div>, document.body)}
  </Glass>;
}
