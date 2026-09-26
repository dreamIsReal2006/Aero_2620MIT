'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, Glass, Icon } from './ui';

const inlineTagPattern = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_.-]{1,50})|(^|[\s([{])#([\p{L}\p{N}_][\p{L}\p{N}_.-]{0,99})/gu;

function renderTaggedContent(content) {
  const text = String(content || '');
  const parts = [];
  let cursor = 0;
  for (const match of text.matchAll(inlineTagPattern)) {
    const [whole, mentionPrefix, username, hashtagPrefix, hashtag] = match;
    const prefix = mentionPrefix ?? hashtagPrefix ?? '';
    const linkStart = match.index + prefix.length;
    if (linkStart > cursor) parts.push(text.slice(cursor, linkStart));
    if (username) {
      parts.push(<a key={`mention-${match.index}`} href={`/profile/${encodeURIComponent(username)}`} className="mention-link" onClick={(event) => event.stopPropagation()}>@{username}</a>);
    } else {
      parts.push(<a key={`hashtag-${match.index}`} href={`/hashtag/${encodeURIComponent(hashtag)}`} className="hashtag-link" onClick={(event) => event.stopPropagation()}>#{hashtag}</a>);
    }
    cursor = match.index + whole.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export default function PostCard({ post, onAction }) {
  const [liked, setLiked] = useState(Boolean(post.is_liked));
  const [likesCount, setLikesCount] = useState(Number(post.likes_count || 0));
  const [bookmarked, setBookmarked] = useState(Boolean(post.is_bookmarked));
  const [viewerIndex, setViewerIndex] = useState(null);
  const author = post.author || post.user || { username: post.username, avatar_url: post.avatar_url };
  const media = post.images || post.media || [];
  const mediaUrl = (item) => String(item).startsWith('http') ? item : `${process.env.NEXT_PUBLIC_API_ORIGIN || ''}${item}`;
  const isVideo = (item) => /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(String(item));

  useEffect(() => {
    if (viewerIndex === null) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setViewerIndex(null);
      if (event.key === 'ArrowLeft') setViewerIndex((index) => (index - 1 + media.length) % media.length);
      if (event.key === 'ArrowRight') setViewerIndex((index) => (index + 1) % media.length);
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
    <p className="mb-4 whitespace-pre-wrap text-[.96rem] leading-6">{renderTaggedContent(post.content || 'Shared a thought with Aero.')}</p>
    {media.length > 0 && <div className={`post-media-container mb-3 ${media.length > 1 ? 'post-media-carousel' : ''}`}>{media.map((item, index) => { const url = mediaUrl(item); const video = isVideo(item); const Media = video ? 'video' : 'img'; return <Media key={`${item}-${index}`} src={url} alt={video ? undefined : 'Post media'} className="post-media-item" loading="lazy" preload={video ? 'metadata' : undefined} controls={video} playsInline={video} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setViewerIndex(index); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setViewerIndex(index); } }} tabIndex={0} role="button" aria-label={`Open media ${index + 1} of ${media.length}`} />; })}</div>}
    <div className="flex items-center justify-between border-t border-black/10 pt-3"><div className="flex items-center gap-1"><button onClick={() => { const nextLiked = !liked; setLiked(nextLiked); setLikesCount((count) => Math.max(0, count + (nextLiked ? 1 : -1))); Promise.resolve(onAction?.('like', post, nextLiked)).then((result) => { if (Number.isFinite(result?.like_count)) setLikesCount(result.like_count); }).catch(() => { setLiked(!nextLiked); setLikesCount((count) => Math.max(0, count + (nextLiked ? -1 : 1))); }); }} className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-transform active:scale-95 ${liked ? 'text-[#d94b62]' : 'text-[#65676b]'}`} aria-label="Like post"><span className="text-base">♥</span>{likesCount}</button><button onClick={() => onAction?.('comment', post)} className="flex items-center gap-1 rounded-full px-2 py-1 text-sm text-[#65676b] hover:text-[#0A84FF]" aria-label="Comment on post"><Icon name="chat" className="h-[18px] w-[18px]" />{post.comments_count || 0}</button></div><button onClick={() => { setBookmarked(!bookmarked); onAction?.('bookmark', post); }} className={`rounded-full px-2 py-1 text-sm ${bookmarked ? 'text-[#0A84FF]' : 'text-[#65676b]'}`} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark post'}><Icon name="bookmark" className="h-[18px] w-[18px]" /></button></div>
    {viewerIndex !== null && typeof document !== 'undefined' && createPortal(<div className="threads-media-modal" role="dialog" aria-modal="true" aria-label="Media viewer" onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) setViewerIndex(null); }}><button type="button" className="threads-media-close" aria-label="Close media viewer" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setViewerIndex(null); }}>×</button><button type="button" className="threads-media-nav threads-media-prev" aria-label="Previous media" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setViewerIndex((index) => (index - 1 + media.length) % media.length); }}>←</button><div className="threads-media-stage">{isVideo(media[viewerIndex]) ? <video className="threads-media-content" src={mediaUrl(media[viewerIndex])} controls autoPlay playsInline /> : <img className="threads-media-content" src={mediaUrl(media[viewerIndex])} alt="Post media" />}</div><button type="button" className="threads-media-nav threads-media-next" aria-label="Next media" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setViewerIndex((index) => (index + 1) % media.length); }}>→</button></div>, document.body)}
  </Glass>;
}
