'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import PostCard from '../../../components/PostCard';
import { Glass } from '../../../components/ui';
import { getValidUrl } from '../../../lib/apiUrl';

export default function HashtagPage() {
  const params = useParams();
  const tag = decodeURIComponent(String(params.tag || '')).replace(/^#/, '');
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(getValidUrl(`api/hashtags/${encodeURIComponent(tag)}/posts?limit=50`), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('aero_token') || ''}` },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to load hashtag posts');
      if (!cancelled) setPosts(data.posts || []);
    }).catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, [tag]);

  return <main className="mx-auto min-h-screen w-full max-w-[680px] px-4 py-8">
    <Link href="/" className="mb-6 inline-block text-sm font-semibold text-[#0A84FF]">← Aero</Link>
    <h1 className="mb-5 text-2xl font-bold text-[#1d9bf0]">#{tag}</h1>
    {error ? <Glass className="rounded-xl p-6 text-center">{error}</Glass> : posts.length ? posts.map((post) => <PostCard key={post.id} post={post} />) : <Glass className="rounded-xl p-6 text-center text-[#65676b]">No posts with this hashtag yet.</Glass>}
  </main>;
}