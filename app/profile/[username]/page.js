// Public profile route for user content and relationships
// From: /profile/:username -> To: backend user and post endpoints
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import PostCard from '../../../components/PostCard';
import FollowsModal from '../../../components/FollowsModal';
import { Avatar, Glass } from '../../../components/ui';
import { getValidUrl } from '../../../lib/apiUrl';

export default function ProfilePage() {
  const params = useParams();
  const username = decodeURIComponent(String(params.username || ''));
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [followsModal, setFollowsModal] = useState({ isOpen: false, initialTab: 'followers' });

  useEffect(() => {
    let cancelled = false;
    fetch(`${getValidUrl('api/users/profile')}?username=${encodeURIComponent(username)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${localStorage.getItem('aero_token') || ''}` },
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Unable to load profile');
      if (!cancelled) {
        setProfile({
          ...data.user,
          followers_count: Number(data.followers_count) || 0,
          following_count: Number(data.following_count) || 0,
          is_following: Boolean(data.is_following),
        });
        setPosts(data.posts || []);
      }
    }).catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, [username]);

  return <main className="mx-auto min-h-screen w-full max-w-[680px] px-4 py-8">
    <Link href="/" className="mb-6 inline-block text-sm font-semibold text-[#0A84FF]">← Aero</Link>
    {error ? <Glass className="rounded-xl p-6 text-center">{error}</Glass> : profile ? <>
      <Glass className="mb-5 rounded-[18px] p-6"><div className="flex items-center gap-4"><Avatar user={profile} className="h-16 w-16 text-xl" /><div><h1 className="text-xl font-bold">{profile.display_name || profile.username}</h1><p className="text-sm text-[#65676b]">@{profile.username}</p></div></div>{profile.bio && <p className="mt-4 whitespace-pre-wrap">{profile.bio}</p>}<div className="mt-4 flex gap-5 text-sm text-[#65676b]"><button type="button" className="hover:underline" onClick={() => setFollowsModal({ isOpen: true, initialTab: 'followers' })}><strong className="text-[var(--aero-text)]">{profile.followers_count}</strong> Followers</button><button type="button" className="hover:underline" onClick={() => setFollowsModal({ isOpen: true, initialTab: 'following' })}><strong className="text-[var(--aero-text)]">{profile.following_count}</strong> Following</button></div></Glass>
      {posts.length ? posts.map((post) => <PostCard key={post.id} post={post} />) : <Glass className="rounded-xl p-6 text-center text-[#65676b]">No posts yet.</Glass>}
      <FollowsModal
        isOpen={followsModal.isOpen}
        onClose={() => setFollowsModal((state) => ({ ...state, isOpen: false }))}
        initialTab={followsModal.initialTab}
        userId={profile.id}
        followersCount={profile.followers_count}
        followingCount={profile.following_count}
        onCountsChange={(counts) => setProfile((current) => current ? { ...current, ...counts } : current)}
      />
    </> : <Glass className="rounded-xl p-6 text-center text-[#65676b]">Loading profile...</Glass>}
  </main>;
}