import { supabase } from './supabaseClient';

function parseImages(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function normalizePost(post) {
  return { ...post, images: parseImages(post.images || post.images_json), username: post.username || post.author?.username || 'User' };
}

export async function getPostsFeed(feedType = 'for_you', userId = null) {
  if (!supabase) return [];
  try {
    let query = supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (feedType === 'following') {
      if (!userId) return [];
      const follows = await supabase.from('follows').select('following_id').eq('follower_id', userId).eq('status', 'approved');
      if (follows.error) return [];
      const ids = (follows.data || []).map((follow) => follow.following_id).filter(Boolean);
      if (!ids.length) return [];
      query = query.in('user_id', ids);
    }
    const { data, error } = await query;
    if (error) return [];
    return (data || []).map(normalizePost);
  } catch { return []; }
}

export async function searchUsers(query) {
  if (!supabase || !query.trim()) return [];
  try {
    const term = `%${query.trim().replace(/[%_,]/g, '')}%`;
    const { data, error } = await supabase.from('users').select('id, username, display_name, email, avatar_url, role, is_banned').or(`username.ilike.${term},email.ilike.${term}`).order('username').limit(20);
    return error ? [] : (data || []);
  } catch { return []; }
}