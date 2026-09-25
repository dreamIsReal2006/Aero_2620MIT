import { supabase } from './supabaseClient';

function parseImages(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function normalizePost(post) {
  return { ...post, images: parseImages(post.images || post.images_json), username: post.username || post.author?.username || 'User' };
}

export async function getPostsFeed(feedType = 'for_you', userId = null, cursor = null, limit = 10) {
  if (!supabase) return { posts: [], has_more: false, next_cursor: null };
  try {
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), 20);
    let query = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(pageSize + 1);
    if (cursor) query = query.lt('created_at', cursor);
    if (feedType === 'following') {
      if (!userId) return { posts: [], has_more: false, next_cursor: null };
      const follows = await supabase.from('follows').select('following_id').eq('follower_id', userId).eq('status', 'approved');
      if (follows.error) return { posts: [], has_more: false, next_cursor: null };
      const ids = (follows.data || []).map((follow) => follow.following_id).filter(Boolean);
      if (!ids.length) return { posts: [], has_more: false, next_cursor: null };
      query = query.in('user_id', ids);
    }
    const { data, error } = await query;
    if (error) return { posts: [], has_more: false, next_cursor: null };
    const rows = data || [];
    const hasMore = rows.length > pageSize;
    const posts = rows.slice(0, pageSize).map(normalizePost);
    return { posts, has_more: hasMore, next_cursor: hasMore ? posts.at(-1)?.created_at || null : null };
  } catch { return { posts: [], has_more: false, next_cursor: null }; }
}

export async function searchUsers(query) {
  if (!supabase || !query.trim()) return [];
  try {
    const term = `%${query.trim().replace(/[%_,]/g, '')}%`;
    const { data, error } = await supabase.from('users').select('id, username, display_name, email, avatar_url, role, is_banned').or(`username.ilike.${term},email.ilike.${term}`).order('username').limit(20);
    return error ? [] : (data || []);
  } catch { return []; }
}