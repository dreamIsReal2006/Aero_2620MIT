'use client';

import { useState } from 'react';
import { Avatar, Glass, Icon } from './ui';

export default function PostCard({ post, onAction }) {
  const [liked, setLiked] = useState(Boolean(post.is_liked));
  const [bookmarked, setBookmarked] = useState(Boolean(post.is_bookmarked));
  const author = post.author || post.user || { username: post.username, avatar_url: post.avatar_url };
  const media = post.images || post.media || [];
  return <Glass className="aero-pop mb-5 rounded-[20px] p-5 transition-transform duration-200 hover:-translate-y-0.5">
    <div className="mb-3 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><Avatar user={author} /><div className="min-w-0"><strong className="block truncate text-sm">@{author.username || 'User'}</strong><span className="text-xs text-[#65676b]">{post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Just now'}</span></div></div><button onClick={() => onAction?.('menu', post)} className="rounded-full px-2 text-lg text-[#65676b] hover:bg-black/5" aria-label="Post options">•••</button></div>
    <p className="mb-4 whitespace-pre-wrap text-[.96rem] leading-6">{post.content || 'Shared a thought with Aero.'}</p>
    {media.length > 0 && <div className={`mb-3 grid gap-2 overflow-hidden rounded-2xl ${media.length > 1 ? 'grid-cols-2' : ''}`}>{media.slice(0, 4).map((item, index) => <img key={`${item}-${index}`} src={String(item).startsWith('http') ? item : `${process.env.NEXT_PUBLIC_API_ORIGIN || ''}${item}`} alt="Post media" className="max-h-[600px] min-h-0 w-full object-cover" loading="lazy" />)}</div>}
    <div className="flex items-center justify-between border-t border-black/10 pt-3"><div className="flex items-center gap-1"><button onClick={() => { setLiked(!liked); onAction?.('like', post); }} className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-transform active:scale-95 ${liked ? 'text-[#d94b62]' : 'text-[#65676b]'}`} aria-label="Like post"><span className="text-base">♥</span>{post.likes_count || 0}</button><button onClick={() => onAction?.('comment', post)} className="flex items-center gap-1 rounded-full px-2 py-1 text-sm text-[#65676b] hover:text-[#0A84FF]" aria-label="Comment on post"><Icon name="chat" className="h-[18px] w-[18px]" />{post.comments_count || 0}</button></div><button onClick={() => { setBookmarked(!bookmarked); onAction?.('bookmark', post); }} className={`rounded-full px-2 py-1 text-sm ${bookmarked ? 'text-[#0A84FF]' : 'text-[#65676b]'}`} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark post'}><Icon name="bookmark" className="h-[18px] w-[18px]" /></button></div>
  </Glass>;
}
