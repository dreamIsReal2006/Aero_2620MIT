const API_BASE = window.AeroConfig.API_BASE_URL;
const API_ORIGIN = window.AeroConfig.API_ORIGIN;
const ADMIN_API_BASE = window.AeroConfig.ADMIN_API_BASE || `${API_ORIGIN}/api/admin`;
const DEFAULT_ADMIN_STATS = { total_users: 0, total_posts: 0, pending_reports: 0 };
const NOTIFICATION_POLL_MS = 30000;
const PRESENCE_POLL_MS = 60000;
const UNREAD_CHAT_POLL_MS = 30000;

function getAuthToken() {
    const token = localStorage.getItem('aero_token');
    return token && token !== 'null' && token !== 'undefined' ? token : '';
}

function authHeaders(extra = {}) {
    const token = getAuthToken();
    return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

function isLoggedIn() {
    return Boolean(getAuthToken());
}

function showLoginModal(message = 'Please sign in to unlock this feature.') {
    const overlay = document.getElementById('auth-overlay');
    const mainApp = document.getElementById('main-app');
    if (overlay) overlay.classList.remove('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    window.showNotice?.(message, 'info');
    document.getElementById('signin-username')?.focus();
}

function requireAuth(action, message = 'Please sign in to unlock this feature.') {
    if (!isLoggedIn()) {
        showLoginModal(message);
        return false;
    }
    return typeof action === 'function' ? action() : true;
}

function syncLandingState(isLanding) {
    document.body.classList.toggle('is-landing-page', Boolean(isLanding));
    document.getElementById('mobile-bottom-nav')?.setAttribute('aria-hidden', String(Boolean(isLanding)));
}

window.isLoggedIn = isLoggedIn;
window.requireAuth = requireAuth;
window.showLoginModal = showLoginModal;
window.AeroAuthHeaders = authHeaders;
window.syncLandingState = syncLandingState;

const HDR_MEDIA_QUERY = '(dynamic-range: high)';

function isHDRSupported() {
    return typeof window.matchMedia === 'function' && window.matchMedia(HDR_MEDIA_QUERY).matches;
}

function applyMediaDisplayCapabilities(root = document) {
    const hdrSupported = isHDRSupported();
    document.documentElement.dataset.hdrSupported = String(hdrSupported);
    root.querySelectorAll?.('img, video').forEach((media) => {
        media.dataset.hdrFallback = String(!hdrSupported);
    });
    return hdrSupported;
}

window.AeroMediaCapabilities = { isHDRSupported, applyMediaDisplayCapabilities };
applyMediaDisplayCapabilities();
if (typeof window.matchMedia === 'function') {
    window.matchMedia(HDR_MEDIA_QUERY).addEventListener?.('change', () => applyMediaDisplayCapabilities());
}

const searchState = {
    highlightedIndex: -1,
    debounceTimer: null,
    ignoreBlur: false
};

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function openThreadsMediaViewer(mediaList, startIndex = 0) {
    const items = Array.isArray(mediaList) ? mediaList.filter(Boolean) : [];
    if (!items.length) return;
    document.getElementById('threads-media-modal')?.remove();
    let currentIndex = Math.min(Math.max(Number(startIndex) || 0, 0), items.length - 1);
    const modal = document.createElement('div');
    modal.id = 'threads-media-modal';
    modal.className = 'threads-media-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Media viewer');
    modal.innerHTML = '<button type="button" class="threads-media-close" aria-label="Close media viewer">&times;</button><button type="button" class="threads-media-nav threads-media-prev" aria-label="Previous media">&#8592;</button><div class="threads-media-stage"></div><button type="button" class="threads-media-nav threads-media-next" aria-label="Next media">&#8594;</button>';
    const stage = modal.querySelector('.threads-media-stage');
    const closeButton = modal.querySelector('.threads-media-close');
    const previousButton = modal.querySelector('.threads-media-prev');
    const nextButton = modal.querySelector('.threads-media-next');
    const close = () => {
        modal.querySelector('video')?.pause();
        document.removeEventListener('keydown', onKeyDown);
        document.body.classList.remove('threads-media-open');
        modal.remove();
    };
    const render = () => {
        stage.replaceChildren();
        const url = items[currentIndex];
        const isVideo = /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(url);
        const media = document.createElement(isVideo ? 'video' : 'img');
        media.className = 'threads-media-content';
        media.alt = isVideo ? '' : 'Post media';
        media.src = url;
        if (isVideo) {
            media.controls = true;
            media.autoplay = true;
            media.playsInline = true;
            media.preload = 'none';
            media.play().catch(() => {});
        }
        stage.appendChild(media);
        previousButton.hidden = items.length < 2;
        nextButton.hidden = items.length < 2;
    };
    const change = (direction) => {
        currentIndex = (currentIndex + direction + items.length) % items.length;
        render();
    };
    const onKeyDown = (event) => {
        if (event.key === 'Escape') close();
        if (event.key === 'ArrowLeft') change(-1);
        if (event.key === 'ArrowRight') change(1);
    };
    closeButton.addEventListener('click', close);
    previousButton.addEventListener('click', () => change(-1));
    nextButton.addEventListener('click', () => change(1));
    modal.addEventListener('click', event => { if (event.target === modal || event.target === stage) close(); });
    document.addEventListener('keydown', onKeyDown);
    document.body.appendChild(modal);
    document.body.classList.add('threads-media-open');
    render();
}

window.openThreadsMediaViewer = openThreadsMediaViewer;

function highlightMatch(text, query) {
    const rawText = String(text ?? '');
    if (!query.trim()) return escapeHtml(rawText);
    const saferQuery = escapeHtml(query.trim());
    const regex = new RegExp(`(${safeRegex(saferQuery)})`, 'ig');
    return escapeHtml(rawText).replace(regex, '<mark>$1</mark>');
}

function safeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderMentionText(value) {
    const escaped = escapeHtml(value ?? '');
    return escaped.replace(/(^|[^A-Za-z0-9_])@([A-Za-z0-9_.-]{1,50})|(^|[\s([{])#([\p{L}\p{N}_][\p{L}\p{N}_.-]{0,99})|📍\s*(-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?|[^,\n]+(?:,\s*[^,\n]+)?)/gu,
        (match, mentionPrefix, username, hashtagPrefix, hashtag, locationText) => {
            if (locationText !== undefined) {
                const location = locationText.trim();
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
                return `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer" class="post-location-link" onclick="event.stopPropagation()">📍 ${escapeHtml(location)}</a>`;
            }
            if (username) {
                const profilePath = `/profile/${encodeURIComponent(username)}`;
                return `${mentionPrefix}<a href="${escapeHtml(profilePath)}" class="mention-link mention-tag" data-username="${escapeHtml(username)}" data-mention-username="${escapeHtml(username)}">@${escapeHtml(username)}</a>`;
            }
            const topicPath = `/hashtag/${encodeURIComponent(hashtag)}`;
            return `${hashtagPrefix}<a href="${escapeHtml(topicPath)}" class="hashtag-link" data-hashtag="${escapeHtml(hashtag)}">#${escapeHtml(hashtag)}</a>`;
        });
}

window.AeroMentionText = renderMentionText;

async function showHashtagPage(tag, updateHistory = true) {
    const normalizedTag = String(tag || '').replace(/^#/, '').trim();
    const feed = document.getElementById('posts-feed');
    if (!normalizedTag || !feed) return;
    if (updateHistory) history.pushState({}, '', `/hashtag/${encodeURIComponent(normalizedTag)}`);
    feed.innerHTML = `<header class="hashtag-topic-header"><button type="button" class="hashtag-topic-back">Back to feed</button><h1>#${escapeHtml(normalizedTag)}</h1></header><div class="hashtag-topic-posts" role="feed" aria-live="polite"><p class="hashtag-topic-state">Loading posts...</p></div>`;
    feed.querySelector('.hashtag-topic-back')?.addEventListener('click', () => {
        history.pushState({}, '', '/');
        AeroAPI.renderFeed('for_you');
    });
    try {
        const response = await fetch(`${API_BASE}/hashtags/${encodeURIComponent(normalizedTag)}/posts?limit=50`, { headers: authHeaders() });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Unable to load hashtag posts');
        const list = feed.querySelector('.hashtag-topic-posts');
        if (!list) return;
        if (!payload.posts?.length) { list.innerHTML = '<p class="hashtag-topic-state">No posts with this hashtag yet.</p>'; return; }
        list.replaceChildren(...payload.posts.map((post) => {
            const article = document.createElement('article');
            article.className = 'post-card glass-card liquid-glass liquid-glass-interactive';
            const author = document.createElement('strong');
            author.className = 'post-author';
            author.textContent = `@${post.username || 'User'}`;
            const content = document.createElement('div');
            content.className = 'post-content';
            content.innerHTML = renderMentionText(post.content || '');
            article.append(author, content);
            return article;
        }));
    } catch (error) {
        const state = feed.querySelector('.hashtag-topic-state');
        if (state) state.textContent = error.message || 'Unable to load hashtag posts.';
    }
}

window.AeroHashtags = { showPage: showHashtagPage };

document.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) return;
    const mention = event.target.closest('.mention-tag');
    const hashtag = event.target.closest('.hashtag-link');
    if (!mention && !hashtag) return;
    event.preventDefault();
    event.stopPropagation();
    if (hashtag) {
        showHashtagPage(hashtag.dataset.hashtag || hashtag.textContent.slice(1));
        return;
    }
    const username = mention.dataset.username || mention.dataset.mentionUsername || '';
    if (!username) return;
    try {
        const response = await fetch(`${API_BASE}/users/profile?username=${encodeURIComponent(username)}`, {
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.user?.id) window.navigateToUserProfile?.(Number(payload.user.id));
        else throw new Error('Profile not found');
    } catch (error) {
        window.showNotice?.('Unable to open this profile.', 'error');
    }
}, true);

function formatRelativeTime(timestamp) {
    if (timestamp === null || timestamp === undefined || timestamp === '') return 'Just now';
    let date;
    if (typeof timestamp === 'number' || (typeof timestamp === 'string' && /^\d+(?:\.\d+)?$/.test(timestamp.trim()))) {
        const numericTimestamp = Number(timestamp);
        date = new Date(numericTimestamp < 1e12 ? numericTimestamp * 1000 : numericTimestamp);
    } else {
        const timestampString = String(timestamp).trim();
        const normalizedTimestamp = /[zZ]|[+-]\d{2}:?\d{2}$/.test(timestampString)
            ? timestampString
            : `${timestampString}Z`;
        date = new Date(normalizedTimestamp);
    }
    const dateValue = date.getTime();
    if (Number.isNaN(dateValue)) return 'Just now';
    const elapsedSeconds = Math.max(0, (Date.now() - dateValue) / 1000);
    const isChinese = window.AeroI18n?.getLanguage?.() === 'zh';
    if (elapsedSeconds < 60) return isChinese ? '刚刚' : 'Just now';
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) return isChinese ? `${minutes}分钟` : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return isChinese ? `${hours}小时` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return isChinese ? `${days}天` : `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return isChinese ? `${months}个月` : `${months}mo ago`;
    const years = Math.floor(months / 12);
    return isChinese ? `${years}年` : `${years}y ago`;
}

window.AeroFormatRelativeTime = formatRelativeTime;

function createAvatarElement(username, avatarUrl, className = 'post-avatar', isOnline = false) {
    const avatar = document.createElement('span');
    avatar.className = className;
    avatar.classList.toggle('is-online', Boolean(isOnline));
    avatar.setAttribute('aria-hidden', 'true');
    const name = String(username || 'User');
    const resolvedAvatarUrl = getUserAvatarUrl({ avatar_url: avatarUrl });
    if (!resolvedAvatarUrl) {
        avatar.textContent = String(avatarUrl || '').startsWith('letter:')
            ? String(avatarUrl).slice(7, 8).toUpperCase() || name.charAt(0).toUpperCase()
            : name.charAt(0).toUpperCase();
        return avatar;
    }

    const image = document.createElement('img');
    image.src = resolvedAvatarUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.onerror = () => {
        avatar.textContent = name.charAt(0).toUpperCase();
        avatar.classList.remove('has-image');
    };
    avatar.appendChild(image);
    avatar.classList.add('has-image');
    return avatar;
}

function getAvatarUrl(user = {}) {
    return getUserAvatarUrl(user);
}

function getUserAvatarUrl(user = {}) {
    const value = String(
        user.avatar_url || user.avatar || user.profile_picture || user.avatarUrl || ''
    ).trim();
    if (!value || value.startsWith('letter:')) return '';
    return value.startsWith('http') ? value : `${API_ORIGIN}${value}`;
}

function renderAvatarMarkup(user = {}, className = 'avatar', sizeClass = '') {
    const username = String(user.username || user.name || user.display_name || 'User');
    const avatarValue = String(user.avatar_url || user.avatarUrl || user.avatar || '').trim();
    const fallback = avatarValue.startsWith('letter:') ? avatarValue.slice(7, 8).toUpperCase() : username.charAt(0).toUpperCase();
    const url = getAvatarUrl(user);
    return `<span class="${escapeHtml(`${className} ${sizeClass}`.trim())}" aria-hidden="true">${url ? `<img src="${escapeHtml(url)}" alt="@${escapeHtml(username)}" loading="lazy" decoding="async" onerror="this.remove();this.parentElement.textContent='${escapeHtml(fallback || 'U')}'">` : escapeHtml(fallback || 'U')}</span>`;
}

window.getUserAvatarUrl = getUserAvatarUrl;
window.AeroAvatar = { getUrl: getUserAvatarUrl, markup: renderAvatarMarkup };

function getCurrentViewerRole(user = null) {
    const viewer = user || JSON.parse(localStorage.getItem('aero_user') || '{}');
    if (viewer.role === 'admin' || viewer.is_admin === true) return 'admin';
    if (viewer.role === 'moderator' || viewer.is_moderator === true) return 'moderator';
    return 'user';
}

function shouldShowBadge(badgeRole, currentViewerRole = getCurrentViewerRole()) {
    if (currentViewerRole === 'admin') return badgeRole === 'admin' || badgeRole === 'moderator';
    if (currentViewerRole === 'moderator') return badgeRole === 'moderator';
    return false;
}

function syncViewerRole(user = null) {
    document.body?.setAttribute('data-viewer-role', getCurrentViewerRole(user));
}

window.shouldShowBadge = shouldShowBadge;
window.syncViewerRole = syncViewerRole;

function roleBadge(role) {
    const normalized = ['admin', 'moderator'].includes(role) ? role : '';
    if (!normalized || !shouldShowBadge(normalized)) return '';
    const icon = normalized === 'admin'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"></path><path d="m9 12 2 2 4-4"></path></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"></path><path d="M8 12h8M12 8v8"></path></svg>';
    const label = window.AeroI18n?.t(`role_${normalized}`) || (normalized === 'admin' ? 'Admin' : 'Moderator');
    return `<span class="role-badge ${normalized}" title="${escapeHtml(label)}">${icon}<span>${escapeHtml(label)}</span></span>`;
}

function syncCurrentUserAvatars(user = {}) {
    const avatarTargets = [
        ['nav-avatar', 'user-avatar user-avatar-nav'],
        ['quick-post-avatar', 'compose-trigger-avatar'],
        ['modal-user-avatar', 'user-avatar']
    ];
    avatarTargets.forEach(([id, className]) => {
        const currentAvatar = document.getElementById(id);
        if (!currentAvatar) return;
        const nextAvatar = createAvatarElement(user.username, getUserAvatarUrl(user), className);
        nextAvatar.id = id;
        currentAvatar.replaceWith(nextAvatar);
    });
}

function renderHeaderNav(user = {}) {
    syncViewerRole(user);
    const adminLink = document.getElementById('admin-dashboard-link');
    const guest = !isLoggedIn();
    document.getElementById('guest-signin-btn')?.classList.toggle('hidden', !guest);
    document.getElementById('user-avatar-btn')?.classList.toggle('hidden', guest);
    if (!adminLink) return;
    const isAdmin = user.is_admin === true || user.role === 'admin';
    const isModerator = user.role === 'moderator' || user.is_moderator === true;
    adminLink.classList.toggle('hidden', !isAdmin && !isModerator);
    adminLink.textContent = isAdmin ? 'Admin Dashboard' : 'Moderator Dashboard';
}

window.renderHeaderNav = renderHeaderNav;

window.addEventListener('aero:user-updated', (event) => {
    const user = event.detail || JSON.parse(localStorage.getItem('aero_user') || '{}');
    syncCurrentUserAvatars(user);
    renderHeaderNav(user);
});

async function refreshCurrentUser() {
    const token = localStorage.getItem('aero_token');
    if (!token) return null;
    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) return null;

        const previous = JSON.parse(localStorage.getItem('aero_user') || '{}');
        const user = { ...previous, ...payload.user };
        localStorage.setItem('aero_user', JSON.stringify(user));
        syncCurrentUserAvatars(user);
        renderHeaderNav(user);
        window.dispatchEvent(new CustomEvent('aero:user-updated', { detail: user }));
        return user;
    } catch (error) {
        console.warn('[Aero current user refresh]', error);
        return null;
    }
}

window.refreshCurrentUser = refreshCurrentUser;

async function updatePresence() {
    if (document.hidden || !localStorage.getItem('aero_token')) return;
    await fetch(`${API_BASE}/users/me/presence`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
    }).catch(() => {});
}

function setupPresenceHeartbeat() {
    let presenceTimer = 0;
    updatePresence();
    const startPresenceTimer = () => {
        window.clearInterval(presenceTimer);
        if (document.hidden || !localStorage.getItem('aero_token')) return;
        presenceTimer = window.setInterval(updatePresence, PRESENCE_POLL_MS);
    };
    startPresenceTimer();
    window.addEventListener('focus', updatePresence);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updatePresence();
            startPresenceTimer();
        } else {
            window.clearInterval(presenceTimer);
        }
    });
}

function renderSearchResults(payload = { users: [], posts: [] }) {
    const dropdown = document.getElementById('search-dropdown-inner');
    const shell = document.getElementById('search-shell');
    const input = document.getElementById('global-search');
    if (!dropdown || !shell || !input) return;

    const users = Array.isArray(payload.users) ? payload.users : [];
    const posts = Array.isArray(payload.posts) ? payload.posts : [];
    const query = input.value.trim();

    if (users.length === 0 && posts.length === 0) {
        dropdown.innerHTML = `<div class="search-empty">${escapeHtml(window.AeroI18n?.translateValue('No results found') || 'No results found')}</div>`;
        shell.classList.remove('is-loading');
        shell.classList.add('is-open');
        return;
    }

    const usersMarkup = users.slice(0, 3).map((user, index) => {
        const name = user.username || user.name || 'Unknown user';
        const tag = user.email || 'Member';
        return `
            <div class="search-result-item search-item ${index === searchState.highlightedIndex ? 'active' : ''}" data-type="user" data-index="${index}" data-user-id="${user.id || ''}" data-username="${escapeHtml(name)}">
                <div class="user-result">
                    <div class="user-avatar">${escapeHtml(name).slice(0, 1).toUpperCase()}</div>
                    <div class="user-details">
                        <span class="user-name">${highlightMatch(name, query)}</span>
                        <span class="user-subline">${highlightMatch(tag, query)}</span>
                    </div>
                </div>
                <button type="button" class="user-action-btn" data-action="visit">${escapeHtml(window.AeroI18n?.t('visit') || 'Visit')}</button>
            </div>
        `;
    }).join('');

    const postsMarkup = posts.slice(0, 3).map((post, index) => {
        const title = post.content || 'Untitled post';
        const author = post.username || 'Unknown author';
        return `
            <div class="search-result-item search-item ${index === searchState.highlightedIndex ? 'active' : ''}" data-type="post" data-index="${index}" data-post-id="${post.id || ''}">
                <div class="post-result">
                    <span class="search-result-title">${highlightMatch(title, query)}</span>
                    <span class="result-meta">${highlightMatch(author, query)}</span>
                </div>
            </div>
        `;
    }).join('');

    const footerText = query
        ? escapeHtml(window.AeroI18n?.t('press_enter_search', { query }) || `Press Enter or Click to see all results for "${query}"`)
        : 'Press Enter or Click to see all results';
    const usersTitle = window.AeroI18n?.t('search_users_title') || 'Users';
    const postsTitle = window.AeroI18n?.t('search_posts_title') || 'Posts / Topics';
    const noPosts = window.AeroI18n?.t('no_posts_found') || 'No posts found';

    dropdown.innerHTML = `
        <section class="search-section">
            <div class="search-section-header">
                <span>${escapeHtml(usersTitle)}</span>
            </div>
            <div class="search-result-list">${usersMarkup || '<div class="search-item"><span class="search-query">No users found</span></div>'}</div>
        </section>
        <section class="search-section">
            <div class="search-section-header">
                <span>${escapeHtml(postsTitle)}</span>
            </div>
            <div class="search-result-list">${postsMarkup || `<div class="search-item"><span class="search-query">${escapeHtml(noPosts)}</span></div>`}</div>
        </section>
        <div class="search-footer"><span>${footerText}</span></div>
    `;

    shell.classList.remove('is-loading');
    shell.classList.add('is-open');
}

const searchPageState = {
    activeTab: 'all',
    loading: false
};

function getQueryFromUrl() {
    const params = new URLSearchParams(window.location.search || '');
    return (params.get('q') || '').trim();
}

function setSearchPageVisibility(showPage) {
    const page = document.getElementById('search-results-page');
    const feed = document.getElementById('view-main');
    if (!page || !feed) return;

    page.classList.toggle('hidden', !showPage);
    feed.classList.toggle('hidden', showPage);
}

function getSearchPageItems(payload = { users: [], posts: [] }, tab = 'all') {
    const users = Array.isArray(payload.users) ? payload.users : [];
    const posts = Array.isArray(payload.posts) ? payload.posts : [];

    if (tab === 'users') return users.map((user) => ({ ...user, kind: 'user' }));
    if (tab === 'posts') return posts.map((post) => ({ ...post, kind: 'post' }));

    return [
        ...users.map((user) => ({ ...user, kind: 'user' })),
        ...posts.map((post) => ({ ...post, kind: 'post' }))
    ];
}

function renderSearchPageResults(payload = { users: [], posts: [] }, tab = 'all') {
    const feed = document.getElementById('search-results-feed');
    if (!feed) return;

    const query = getQueryFromUrl() || document.getElementById('global-search')?.value.trim() || '';
    const items = getSearchPageItems(payload, tab);
    feed.dataset.payload = JSON.stringify(payload || { users: [], posts: [] });
    feed.dataset.searchState = 'ready';

    if (!query) {
        feed.innerHTML = '<div class="search-empty-state"><div class="search-empty-message">Search for something to begin.</div></div>';
        return;
    }

    if (!items.length) {
        feed.innerHTML = `<div class="search-empty-state"><div class="search-empty-message">No results found for "${escapeHtml(query)}"</div></div>`;
        return;
    }

    const itemMarkup = items.map((item) => {
        if (item.kind === 'user') {
            const username = item.username || 'Unknown user';
            const email = item.email || 'Member';
            const avatar = renderAvatarMarkup(item, 'search-page-avatar');
            return `
                <article class="search-page-card search-user-card" data-navigate="/profile/${encodeURIComponent(username)}" tabindex="0" role="button" aria-label="Open profile for ${escapeHtml(username)}">
                    ${avatar}
                    <div class="search-page-copy">
                        <div class="search-page-title">${highlightMatch(username, query)}</div>
                        <div class="search-page-meta">${highlightMatch(email, query)}</div>
                    </div>
                    <span class="search-page-tag">User</span>
                </article>
            `;
        }

        const content = item.content || 'Untitled post';
        const author = item.username || 'Unknown author';
        return `
            <article class="search-page-card search-post-card" data-post-id="${item.id || ''}" tabindex="0" role="button" aria-label="Open post by ${escapeHtml(author)}">
                <div class="search-page-copy">
                    <div class="search-page-title">${highlightMatch(content, query)}</div>
                    <div class="search-page-meta">by ${highlightMatch(author, query)}</div>
                </div>
                <span class="search-page-tag">Post</span>
            </article>
        `;
    }).join('');

    feed.innerHTML = itemMarkup;

    feed.querySelectorAll('[data-navigate], [data-post-id]').forEach((card) => {
        const go = () => {
            if (card.dataset.postId) {
                openSearchPost(Number(card.dataset.postId));
                return;
            }
            const target = card.getAttribute('data-navigate');
            if (target) window.location.href = target;
        };

        card.addEventListener('click', go);
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                go();
            }
        });
    });
}

async function loadSearchPageResults() {
    const query = getQueryFromUrl();
    const feed = document.getElementById('search-results-feed');
    if (!feed) return;

    if (!query) {
        renderSearchPageResults({ users: [], posts: [] }, searchPageState.activeTab);
        return;
    }

    searchPageState.loading = true;
    feed.dataset.searchState = 'loading';
    feed.innerHTML = `
        <div class="search-page-skeleton-group">
            <div class="search-page-skeleton-card"></div>
            <div class="search-page-skeleton-card"></div>
            <div class="search-page-skeleton-card"></div>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        if (!response.ok) throw new Error('Search results request failed');

        const payload = await response.json();
        feed.dataset.payload = JSON.stringify(payload || { users: [], posts: [] });
        renderSearchPageResults(payload || { users: [], posts: [] }, searchPageState.activeTab);
    } catch (error) {
        const emptyPayload = { users: [], posts: [] };
        feed.dataset.payload = JSON.stringify(emptyPayload);
        renderSearchPageResults(emptyPayload, searchPageState.activeTab);
    } finally {
        searchPageState.loading = false;
    }
}

function setupSearchPage() {
    const tabs = document.querySelectorAll('.search-tab');
    const input = document.getElementById('global-search');

    if (tabs.length) {
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const nextTab = tab.dataset.tab || 'all';
                searchPageState.activeTab = nextTab;
                tabs.forEach((item) => item.classList.toggle('active', item === tab));

                const feed = document.getElementById('search-results-feed');
                if (!feed) return;

                const payload = feed.dataset.payload ? JSON.parse(feed.dataset.payload) : { users: [], posts: [] };
                renderSearchPageResults(payload, nextTab);
            });
        });
    }

    const query = getQueryFromUrl();
    if (input && query) {
        input.value = query;
        updateSearchState();
    }

    if (window.location.pathname === '/search' || window.location.pathname.endsWith('/search')) {
        setSearchPageVisibility(true);
        loadSearchPageResults();
    }
}

function updateSearchState() {
    const input = document.getElementById('global-search');
    const shell = document.getElementById('search-shell');
    if (!input || !shell) return;

    shell.classList.toggle('has-value', input.value.trim().length > 0);
}

async function fetchSearchResults(query) {
    const shell = document.getElementById('search-shell');
    const dropdown = document.getElementById('search-dropdown-inner');
    if (!shell || !dropdown) return;

    shell.classList.add('is-loading');
    dropdown.innerHTML = '<div class="search-status"><span class="search-spinner"></span> Loading...</div>';

    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        if (!response.ok) {
            throw new Error('Search request failed');
        }
        const data = await response.json();
        renderSearchResults(data || { users: [], posts: [] });
    } catch (error) {
        shell.classList.remove('is-loading');
        dropdown.innerHTML = '<div class="search-empty">No results found</div>';
    }
}

function handleSearchInput() {
    const input = document.getElementById('global-search');
    const shell = document.getElementById('search-shell');
    if (!input || !shell) return;

    updateSearchState();
    const query = input.value.trim();
    if (!query) {
        shell.classList.remove('is-loading', 'is-open', 'is-focused');
        return;
    }

    shell.classList.add('is-focused', 'is-open');
    clearTimeout(searchState.debounceTimer);
    searchState.debounceTimer = setTimeout(() => {
        fetchSearchResults(query);
    }, 300);
}

function openSearchPanel() {
    const shell = document.getElementById('search-shell');
    const searchInput = document.getElementById('global-search');
    const dropdown = document.getElementById('search-dropdown');
    if (!shell || !searchInput || !dropdown) return;

    const query = searchInput.value.trim();
    shell.classList.add('is-focused');
    if (query) {
        shell.classList.add('is-open');
        dropdown.setAttribute('aria-expanded', 'true');
        fetchSearchResults(query);
    } else {
        shell.classList.remove('is-open');
        dropdown.setAttribute('aria-expanded', 'false');
    }
}

function closeSearchPanel() {
    const shell = document.getElementById('search-shell');
    const dropdown = document.getElementById('search-dropdown');
    if (!shell || !dropdown) return;
    shell.classList.remove('is-open', 'is-focused', 'is-loading');
    dropdown.setAttribute('aria-expanded', 'false');
    searchState.highlightedIndex = -1;
}

function resetAndCloseSearch() {
    const input = document.getElementById('global-search');
    if (input) input.value = '';
    updateSearchState();
    closeSearchPanel();
}

function moveSearchHighlight(direction) {
    const dropdown = document.getElementById('search-dropdown-inner');
    const input = document.getElementById('global-search');
    if (!dropdown || !input) return;

    const query = input.value.trim();
    if (!query) {
        searchState.highlightedIndex = -1;
        return;
    }

    const items = Array.from(dropdown.querySelectorAll('.search-result-item'));
    if (!items.length) return;

    const nextIndex = searchState.highlightedIndex < 0
        ? (direction > 0 ? 0 : items.length - 1)
        : Math.max(0, Math.min(items.length - 1, searchState.highlightedIndex + direction));

    searchState.highlightedIndex = nextIndex;
    items.forEach((item, index) => {
        const active = index === nextIndex;
        item.classList.toggle('is-active', active);
        item.classList.toggle('active', active);
    });
}

function triggerSearchItemNavigation(item) {
    if (!item) return;
    const type = item.dataset.type;
    const username = item.dataset.username;
    const userId = item.dataset.userId;
    const postId = item.dataset.postId;

    if (type === 'user' && userId) {
        closeSearchPanel();
        window.navigateToUserProfile?.(Number(userId));
        return;
    }

    if (type === 'post' && postId) {
        openSearchPost(Number(postId));
    }
}

async function openSearchPost(postId) {
    if (!Number.isInteger(postId) || postId <= 0) return;
    closeSearchPanel();
    setSearchPageVisibility(false);
    window.AeroRouter?.navigate('main');
    let postElement = document.querySelector(`#posts-feed [data-post-id="${postId}"]`);
    if (!postElement) {
        await AeroAPI.renderFeed();
        postElement = document.querySelector(`#posts-feed [data-post-id="${postId}"]`);
    }
    if (postElement) {
        window.ViewHistory?.showOnlyPost(postId);
        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        postElement.classList.add('bookmark-focus');
        window.setTimeout(() => postElement.classList.remove('bookmark-focus'), 1200);
    } else {
        showNotice('This post is no longer available.', 'info');
    }
}

function setupSearchInteraction() {
    const shell = document.getElementById('search-shell');
    const searchBar = document.getElementById('search-bar');
    const input = document.getElementById('global-search');
    const dropdown = document.getElementById('search-dropdown');
    const clearBtn = document.getElementById('search-clear-btn');

    if (!shell || !searchBar || !input || !dropdown || !clearBtn) return;

    dropdown.setAttribute('aria-expanded', 'false');
    searchBar.addEventListener('click', (event) => {
        if (event.target.closest('.remove-item')) return;
        if (document.activeElement !== input) {
            input.focus();
        }
        openSearchPanel();
    });

    input.addEventListener('focus', () => {
        if (input.value.trim()) {
            shell.classList.add('is-focused', 'is-open');
            fetchSearchResults(input.value.trim());
        }
    });

    input.addEventListener('blur', () => {
        window.setTimeout(() => {
            if (searchState.ignoreBlur) {
                searchState.ignoreBlur = false;
                return;
            }
            if (!shell.contains(document.activeElement)) {
                closeSearchPanel();
            }
        }, 120);
    });

    dropdown.addEventListener('mousedown', (event) => {
        if (event.target.closest('[data-action="visit"]')) return;
        const item = event.target.closest('.search-result-item');
        if (!item) return;
        searchState.ignoreBlur = true;
        event.preventDefault();
        triggerSearchItemNavigation(item);
    });

    dropdown.addEventListener('click', (event) => {
        const visitButton = event.target.closest('[data-action="visit"]');
        if (!visitButton) return;
        event.preventDefault();
        event.stopPropagation();
        triggerSearchItemNavigation(visitButton.closest('.search-result-item'));
    });

    input.addEventListener('input', handleSearchInput);

    clearBtn.addEventListener('click', () => {
        input.value = '';
        updateSearchState();
        closeSearchPanel();
        input.focus();
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeSearchPanel();
            input.blur();
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const query = input.value.trim();
            if (query) {
                moveSearchHighlight(1);
            }
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            const query = input.value.trim();
            if (query) {
                moveSearchHighlight(-1);
            }
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            const query = input.value.trim();

            if (searchState.highlightedIndex >= 0) {
                const highlightedItem = Array.from(dropdown.querySelectorAll('.search-result-item'))[searchState.highlightedIndex];
                triggerSearchItemNavigation(highlightedItem);
                return;
            }

            if (query) {
                window.location.href = `/search?q=${encodeURIComponent(query)}`;
            }
        }
    });

    document.addEventListener('click', (event) => {
        if (!shell.contains(event.target)) {
            resetAndCloseSearch();
        }
    });

    window.addEventListener('scroll', resetAndCloseSearch, { passive: true });
    document.addEventListener('touchmove', (event) => {
        if (!shell.contains(event.target)) resetAndCloseSearch();
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
        const metaKey = event.metaKey || event.ctrlKey;
        if (metaKey && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            openSearchPanel();
            document.getElementById('global-search')?.focus();
        }
    });

    dropdown.setAttribute('aria-expanded', 'false');
    closeSearchPanel();
    updateSearchState();

    if (window.location.pathname === '/search' || window.location.pathname.endsWith('/search')) {
        const input = document.getElementById('global-search');
        if (input) {
            input.value = getQueryFromUrl();
            updateSearchState();
        }
    }
}

function createIcon(pathData, label) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.classList.add('button-icon');
    icon.innerHTML = pathData;
    icon.parentElement?.setAttribute('aria-label', label);
    return icon;
}

function showNotice(message, type = 'info', options = {}) {
    let overlay = document.getElementById('notice-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'notice-overlay';
        overlay.className = 'notice-overlay';
        overlay.setAttribute('role', 'presentation');
        overlay.innerHTML = `
            <div class="notice-dialog" role="alertdialog" aria-modal="true" aria-labelledby="notice-title">
                <div class="notice-icon" aria-hidden="true"></div>
                <div class="notice-copy">
                    <strong id="notice-title">Aero</strong>
                    <p id="notice-message"></p>
                </div>
                <div class="notice-actions"></div>
                <button class="notice-close" type="button" aria-label="Close notification" title="Close notification">&times;</button>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.notice-close').addEventListener('click', () => closeNotice(overlay));
    }

    const dialog = overlay.querySelector('.notice-dialog');
    const icon = overlay.querySelector('.notice-icon');
    const title = overlay.querySelector('#notice-title');
    const messageElement = overlay.querySelector('#notice-message');
    const actionArea = overlay.querySelector('.notice-actions');
    const icons = {
        success: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>',
        error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="m9 9 6 6m0-6-6 6"></path></svg>',
        info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="M12 10v5m0-8v.1"></path></svg>'
    };
    icon.innerHTML = icons[type] || icons.info;
    title.textContent = type === 'success' ? 'All set' : type === 'error' ? 'Something went wrong' : 'Aero';
    messageElement.textContent = message;
    actionArea.innerHTML = '';
    if (options.actionLabel && typeof options.onAction === 'function') {
        const actionButton = document.createElement('button');
        actionButton.type = 'button';
        actionButton.className = 'notice-action-btn';
        actionButton.textContent = options.actionLabel;
        actionButton.addEventListener('click', () => {
            options.onAction();
            closeNotice(overlay);
        });
        actionArea.appendChild(actionButton);
    }
    dialog.dataset.type = type;
    overlay.classList.remove('hidden', 'is-closing');
    window.clearTimeout(overlay.noticeTimer);
    overlay.noticeTimer = window.setTimeout(() => closeNotice(overlay), 4200);
}

const PANEL_SELECTORS = ['#notifications-drawer', '#bookmarks-drawer', '#history-drawer'];

function closeAllPanels() {
    PANEL_SELECTORS.forEach((selector) => {
        const panel = document.querySelector(selector);
        panel?.classList.add('hidden');
        panel?.classList.remove('active');
    });
    document.querySelectorAll('#notification-dock-btn, #bookmark-dock-btn, #history-dock-btn').forEach((button) => button.classList.remove('active'));
}

function openExclusivePanel(targetSelector) {
    const target = document.querySelector(targetSelector);
    if (!target) return false;
    const shouldOpen = target.classList.contains('hidden');
    closeAllPanels();
    if (shouldOpen) {
        target.classList.remove('hidden');
        target.classList.add('active');
        const button = document.querySelector({ '#notifications-drawer': '#notification-dock-btn', '#bookmarks-drawer': '#bookmark-dock-btn', '#history-drawer': '#history-dock-btn' }[targetSelector]);
        button?.classList.add('active');
    }
    return shouldOpen;
}

window.AeroPanelController = { openExclusivePanel, closeAllPanels };

function setBookmarkDrawerVisibility(isOpen) {
    const drawer = document.getElementById('bookmarks-drawer');
    const dockButton = document.getElementById('bookmark-dock-btn');
    if (!drawer || !dockButton) return;
    if (isOpen) openExclusivePanel('#bookmarks-drawer');
    else closeAllPanels();
}

let notificationItems = [];
let notificationTab = 'all';
let notificationUnreadCount = null;
let chatUnreadCount = null;
const chatMessageSnapshots = new Map();
let notificationRealtimeChannel = null;
const notificationSound = new Audio('assets/audio/notification.mp3');
notificationSound.preload = 'auto';
let notificationSoundUnlocked = false;
let notificationSoundPending = false;

function playNotificationSound() {
    if (!notificationSoundUnlocked) {
        notificationSoundPending = true;
        return;
    }
    notificationSound.currentTime = 0;
    notificationSound.play().catch(() => {});
}

function setupNotificationSoundUnlock() {
    const unlock = () => {
        notificationSoundUnlocked = true;
        notificationSound.load();
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
        if (notificationSoundPending) {
            notificationSoundPending = false;
            playNotificationSound();
        }
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
}

function updateDockBadge(buttonId, count) {
    const badge = document.querySelector(`#${buttonId} .dock-badge`);
    const unreadCount = Number(count) || 0;
    if (badge) {
        badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        badge.classList.toggle('hidden', unreadCount < 1);
    }
    if (buttonId === 'chat-dock-btn') {
        const mobileBadge = document.querySelector('.mobile-bottom-badge');
        mobileBadge?.classList.toggle('hidden', unreadCount < 1);
        if (mobileBadge) mobileBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    }
}

function setNotificationDrawerVisibility(isOpen) {
    const drawer = document.getElementById('notifications-drawer');
    const button = document.getElementById('notification-dock-btn');
    if (!drawer || !button) return;
    if (isOpen) openExclusivePanel('#notifications-drawer');
    else closeAllPanels();
}

function renderNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    const items = notificationItems.filter((item) => notificationTab === 'all' || item.type === notificationTab || (notificationTab === 'mentions' && item.type === 'mention'));
    list.innerHTML = items.length ? items.map((item) => {
        const actor = item.actor || {};
        const icon = item.type === 'like' ? '♥' : item.type === 'comment' ? '●' : item.type === 'follow' ? '●' : '↗';
        const avatarUrl = actor.avatar_url ? (actor.avatar_url.startsWith('http') ? actor.avatar_url : `${API_ORIGIN}${actor.avatar_url}`) : '';
        const avatar = avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : escapeHtml((actor.username || 'S').charAt(0).toUpperCase());
        const fallbackMessage = item.type === 'follow' ? 'followed_you' : item.type === 'like' ? 'liked_your_post' : `${item.type} your post`;
        const message = item.message || (window.AeroI18n?.t(fallbackMessage) || fallbackMessage);
        return `<article class="notification-item" data-post-id="${item.post_id || ''}" tabindex="0"><span class="notification-avatar">${avatar}</span><div class="notification-copy"><strong>@${escapeHtml(actor.username || 'Someone')}</strong><span>${escapeHtml(message)}</span><time>${formatRelativeTime(item.created_at)}</time><p>${escapeHtml(item.post_content || '')}</p></div><span class="notification-type-icon">${icon}</span></article>`;
    }).join('') : `<div class="bookmarks-empty">${window.AeroI18n?.t('no_notifications') || 'No notifications'}</div>`;
    list.querySelectorAll('.notification-item').forEach((item) => item.addEventListener('click', () => {
        const post = document.querySelector(`[data-post-id="${item.dataset.postId}"]`);
        setNotificationDrawerVisibility(false);
        post?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
}

async function loadNotifications(markRead = true) {
    try {
        const response = await fetch(`${API_BASE}/notifications`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load notifications');
        notificationItems = data.notifications || [];
        const unreadCount = Number(data.unread_count) || 0;
        if (!markRead && notificationUnreadCount !== null && unreadCount > notificationUnreadCount) playNotificationSound();
        notificationUnreadCount = unreadCount;
        updateDockBadge('notification-dock-btn', unreadCount);
        renderNotifications();
        if (markRead) {
            await fetch(`${API_BASE}/notifications/read-all`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
            notificationUnreadCount = 0;
            updateDockBadge('notification-dock-btn', 0);
        }
    } catch (error) {
        const list = document.getElementById('notifications-list');
        if (list) list.innerHTML = `<div class="bookmarks-empty">${escapeHtml(error.message)}</div>`;
    }
}

function stopNotificationRealtime() {
    if (!notificationRealtimeChannel) return;
    const channel = notificationRealtimeChannel;
    notificationRealtimeChannel = null;
    window.AeroSupabase?.removeChannel(channel).catch(() => {});
}

function setupNotificationRealtime() {
    const client = window.AeroSupabase;
    const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
    if (!client || !currentUser.id || !localStorage.getItem('aero_token')) return;
    stopNotificationRealtime();
    notificationRealtimeChannel = client
        .channel(`aero-notifications-${currentUser.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`
        }, (payload) => {
            if (document.hidden || Number(payload.new?.user_id) !== Number(currentUser.id)) return;
            loadNotifications(false).catch(() => {});
            playNotificationSound();
        })
        .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.error('[Aero notifications realtime error]', status);
        });
}

window.AeroStopNotificationRealtime = stopNotificationRealtime;
window.addEventListener('pagehide', stopNotificationRealtime);

function setupNotificationDrawer() {
    let notificationTimer = 0;
    let unreadChatTimer = 0;
    setupNotificationSoundUnlock();
    const button = document.getElementById('notification-dock-btn');
    button?.addEventListener('click', () => {
        const drawer = document.getElementById('notifications-drawer');
        const opening = drawer?.classList.contains('hidden');
        setNotificationDrawerVisibility(Boolean(opening));
        if (opening) loadNotifications();
    });
    document.getElementById('close-notifications-drawer')?.addEventListener('click', () => setNotificationDrawerVisibility(false));
    document.querySelectorAll('.notification-tab').forEach((tab) => tab.addEventListener('click', () => {
        notificationTab = tab.dataset.notificationTab || 'all';
        document.querySelectorAll('.notification-tab').forEach((item) => item.classList.toggle('active', item === tab));
        renderNotifications();
    }));
    if (localStorage.getItem('aero_token')) {
        loadNotifications(false);
        loadUnreadChatCount().catch(() => {});
        setupNotificationRealtime();
        const startNotificationTimer = () => {
            window.clearInterval(notificationTimer);
            window.clearInterval(unreadChatTimer);
            if (document.hidden || !localStorage.getItem('aero_token')) return;
            notificationTimer = window.setInterval(() => loadNotifications(false), NOTIFICATION_POLL_MS);
            unreadChatTimer = window.setInterval(() => loadUnreadChatCount().catch(() => {}), UNREAD_CHAT_POLL_MS);
        };
        startNotificationTimer();
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                window.clearInterval(notificationTimer);
                window.clearInterval(unreadChatTimer);
            }
            else {
                loadNotifications(false);
                loadUnreadChatCount().catch(() => {});
                startNotificationTimer();
            }
        });
    }
}

let activeChatUser = null;
let chatContactCache = [];
let chatGroupCache = [];
let chatRealtimeChannel = null;
let feedRenderRequestId = 0;
let appStateInitialized = false;
const messagesCache = new Map();
const chatLoadRequests = new Map();
const chatGroupUnreadCounts = new Map();
const CHAT_CIPHER_PREFIX = 'AERO_E2EE_V1:';
let feedCursor = '';
let feedHasMore = true;
let feedLoading = false;
let feedTypeState = 'for_you';
let feedLoadObserver = null;

function chatConversationKeyId(conversation) {
    const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
    if (conversation?.is_group) return `group:${conversation.group_id || conversation.id}`;
    return `direct:${[currentUser.id, conversation?.id].map(Number).sort((a, b) => a - b).join(':')}`;
}

function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function getChatEncryptionKey(conversation) {
    if (!window.crypto?.subtle || !conversation) return null;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`aero-chat:${chatConversationKeyId(conversation)}`));
    return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptChatContent(content, conversation) {
    const key = await getChatEncryptionKey(conversation);
    if (!key || !content) return content;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(content));
    return `${CHAT_CIPHER_PREFIX}${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decryptChatContent(content, conversation) {
    if (!content || !String(content).startsWith(CHAT_CIPHER_PREFIX)) return content || '';
    try {
        const key = await getChatEncryptionKey(conversation);
        if (!key) return '[Encrypted message]';
        const [iv, ciphertext] = String(content).slice(CHAT_CIPHER_PREFIX.length).split('.');
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, key, base64ToBytes(ciphertext));
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        return '[Unable to decrypt message]';
    }
}

async function decryptChatPreview(content, conversation) {
    return decryptChatContent(content, conversation);
}

function isActiveChatMessage(message, contact) {
    if (!message || !contact) return false;
    if (contact.is_group) return Number(message.group_id) === Number(contact.group_id || contact.id);
    return !message.group_id
        && Number(message.sender_id) === Number(contact.id)
        && Number(message.recipient_id) === Number(JSON.parse(localStorage.getItem('aero_user') || '{}').id);
}

async function appendSingleMessageToUI(message, conversation = activeChatUser || window.activeChatUser) {
    const contact = conversation;
    const box = document.getElementById('chat-messages-list') || document.getElementById('chat-messages');
    const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
    if (!box || !contact || box.querySelector(`[data-message-id="${message.id}"]`)) return false;
    const content = escapeHtml(await decryptChatContent(message.content, contact));
    const mediaUrl = message.media_url ? (String(message.media_url).startsWith('http') ? message.media_url : `${API_ORIGIN}${message.media_url}`) : '';
    const videoType = /\.mov(?:$|\?)/i.test(mediaUrl) ? 'video/quicktime' : /\.webm(?:$|\?)/i.test(mediaUrl) ? 'video/webm' : /\.m4v(?:$|\?)/i.test(mediaUrl) ? 'video/x-m4v' : 'video/mp4';
    const media = mediaUrl && message.type === 'image'
        ? `<img src="${escapeHtml(mediaUrl)}" class="chat-gif-media" alt="Attached image" loading="lazy">`
        : mediaUrl && message.type === 'gif'
            ? `<img src="${escapeHtml(mediaUrl)}" class="chat-gif-media" alt="GIF" loading="lazy">`
        : mediaUrl && message.type === 'video'
            ? `<video class="chat-inline-video" controls preload="metadata" playsinline crossorigin="anonymous"><source src="${escapeHtml(mediaUrl)}" type="${videoType}"></video>`
            : mediaUrl && message.type === 'audio'
                ? `<audio class="chat-inline-audio" src="${escapeHtml(mediaUrl)}" controls></audio>`
            : '';
    const node = document.createElement('div');
    node.className = `chat-message ${Number(message.sender_id) === Number(currentUser.id) ? 'mine' : ''}`;
    node.dataset.messageId = message.id;
    const timestamp = window.AeroI18n?.formatChatTimestamp?.(message.created_at) || formatRelativeTime(message.created_at);
    const deliveryStatus = message.status === 'sending'
        ? '<span class="chat-delivery-status sending">Sending...</span>'
        : message.status === 'failed'
            ? '<span class="chat-delivery-status failed">Failed</span>'
            : '';
    node.classList.toggle('is-sending', message.status === 'sending');
    node.classList.toggle('is-failed', message.status === 'failed');
    node.innerHTML = `${contact.is_group && Number(message.sender_id) !== Number(currentUser.id) ? '<small class="chat-group-sender">New message</small>' : ''}<div class="chat-bubble-content message-bubble">${media}${content}</div><div class="chat-message-meta"><time class="message-time">${escapeHtml(timestamp)}</time>${deliveryStatus}</div>`;
    box.appendChild(node);
    box.scrollTop = box.scrollHeight;
    return true;
}

window.appendSingleMessageToUI = appendSingleMessageToUI;

async function appendRealtimeChatMessage(message) {
    const contact = activeChatUser || window.activeChatUser;
    if (!isActiveChatMessage(message, contact)) return false;
    const cached = messagesCache.get(chatConversationKey(contact));
    if (cached && !cached.some((item) => String(item.id) === String(message.id))) cached.push(message);
    return appendSingleMessageToUI(message, contact);
}

function updateChatContactPreview(message, preview, conversation = activeChatUser || window.activeChatUser) {
    const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
    const contactId = message.group_id
        ? message.group_id
        : Number(message.sender_id) === Number(currentUser.id) ? message.recipient_id : message.sender_id;
    const selector = message.group_id
        ? `.chat-contact[data-group-id="${CSS.escape(String(message.group_id))}"]`
        : `.chat-contact[data-user-id="${CSS.escape(String(contactId))}"]`;
    const item = document.querySelector(selector);
    if (!item) return;
    const summary = item.querySelector('small');
    if (summary) summary.textContent = preview;
    const timestamp = item.querySelector('time');
    if (timestamp) timestamp.textContent = formatRelativeTime(message.created_at);
    item.dataset.latestMessageAt = message.created_at || '';
    const isCurrentConversation = conversation && (message.group_id
        ? conversation.is_group && String(conversation.group_id || conversation.id) === String(message.group_id)
        : !conversation.is_group && String(conversation.id) === String(contactId));
    item.classList.toggle('unread', !isCurrentConversation && Number(message.sender_id) !== Number(currentUser.id));
}

function getLocalGroupUnreadCount() {
    return [...chatGroupUnreadCounts.values()].reduce((total, count) => total + count, 0);
}

function setupChatRealtime() {
    const client = window.supabaseClient;
    const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
    if (!client || !currentUser.id) return;
    if (chatRealtimeChannel) client.removeChannel(chatRealtimeChannel);
    chatRealtimeChannel = client.channel(`aero-messages-${currentUser.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
        }, ({ new: message }) => {
            if (Number(message.sender_id) === Number(currentUser.id)) return;
            const contact = activeChatUser || window.activeChatUser;
            const activeContactId = contact?.group_id || contact?.id;
            const isCurrentChat = Boolean(contact) && (contact.is_group
                ? String(message.group_id) === String(activeContactId)
                : !message.group_id
                    && String(message.sender_id) === String(activeContactId)
                    && String(message.recipient_id) === String(currentUser.id));
            if (isCurrentChat) {
                appendSingleMessageToUI(message, contact).then(async () => {
                    updateChatContactPreview(message, await decryptChatContent(message.content, contact), contact);
                    markConversationRead(contact).catch(() => {});
                }).catch(() => {});
            } else {
                const isIncoming = Number(message.sender_id) !== Number(currentUser.id)
                    && (message.group_id || Number(message.recipient_id) === Number(currentUser.id));
                if (isIncoming && message.group_id) {
                    const groupId = String(message.group_id);
                    chatGroupUnreadCounts.set(groupId, (chatGroupUnreadCounts.get(groupId) || 0) + 1);
                    updateDockBadge('chat-dock-btn', (chatUnreadCount || 0) + getLocalGroupUnreadCount());
                }
                decryptChatPreview(message.content, message.group_id ? { id: message.group_id, group_id: message.group_id, is_group: true } : { id: message.sender_id }).then((preview) => updateChatContactPreview(message, preview, contact)).catch(() => {});
                loadUnreadChatCount().catch(() => {});
                loadChatContacts().catch(() => {});
            }
        })
        .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.error('[Aero chat realtime error]', status);
        });
}
    window.setupChatRealtime = setupChatRealtime;

async function loadShortVideos() {
    const feed = document.getElementById('video-feed');
    if (!feed) return;
    try {
        const response = await fetch(`${API_BASE}/videos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
        const videos = await response.json();
        if (!response.ok) throw new Error(videos.message || 'Unable to load videos');
        feed.innerHTML = videos.length ? videos.map((video) => { const videoType = /\.mov(?:$|\?)/i.test(video.video_url) ? 'video/quicktime' : /\.webm(?:$|\?)/i.test(video.video_url) ? 'video/webm' : /\.m4v(?:$|\?)/i.test(video.video_url) ? 'video/x-m4v' : 'video/mp4'; return `<article class="short-video-card"><video playsinline loop preload="metadata" data-hdr-fallback="${!window.AeroMediaCapabilities?.isHDRSupported()}"><source src="${escapeHtml(video.video_url)}" type="${videoType}"></video><div class="short-video-overlay"><button type="button" class="video-action" aria-label="Like video">♥</button><button type="button" class="video-action" aria-label="Comment on video">●</button><button type="button" class="video-action" aria-label="Share video">↗</button></div><div class="short-video-meta"><span class="video-author-avatar">${escapeHtml((video.author?.username || 'U').charAt(0).toUpperCase())}</span><div><strong>@${escapeHtml(video.author?.username || 'User')}</strong><p>${escapeHtml(video.caption || '')}</p><small>♫ ${escapeHtml(video.track_name || 'Original audio')}</small></div><button type="button" class="video-mute-btn" aria-label="Mute video">🔊</button></div></article>`; }).join('') : '<div class="bookmarks-empty">No short videos yet.</div>';
        feed.querySelectorAll('video').forEach((video) => {
            video.muted = true;
            video.play().catch(() => {});
            const muteButton = video.closest('.short-video-card').querySelector('.video-mute-btn');
            muteButton.addEventListener('click', () => { video.muted = !video.muted; muteButton.textContent = video.muted ? '🔇' : '🔊'; });
        });
    } catch (error) {
        feed.innerHTML = `<div class="bookmarks-empty">${escapeHtml(error.message)}</div>`;
    }
}

async function loadChatContacts() {
    const list = document.getElementById('chat-contacts-list');
    if (!list) return;
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` };
    const [contactsResponse, groupsResponse] = await Promise.all([
        fetch(`${API_BASE}/chat/contacts`, { headers }),
        fetch(`${API_BASE}/chat/groups`, { headers })
    ]);
    chatContactCache = contactsResponse.ok ? await contactsResponse.json() : [];
    chatGroupCache = groupsResponse.ok ? await groupsResponse.json() : [];
    const contactMarkup = (chatContactCache || []).map((contact) => {
        const avatarUrl = contact.avatar_url && !String(contact.avatar_url).startsWith('letter:')
            ? (String(contact.avatar_url).startsWith('http') ? contact.avatar_url : `${API_ORIGIN}${contact.avatar_url}`)
            : '';
        const avatarText = String(contact.avatar_url || '').startsWith('letter:')
            ? String(contact.avatar_url).slice(7, 8).toUpperCase()
            : (contact.username || 'U').charAt(0).toUpperCase();
        const avatar = avatarUrl
            ? `<img src="${escapeHtml(avatarUrl)}" alt="" loading="lazy" onerror="this.remove()">`
            : escapeHtml(avatarText || 'U');
        return `<button type="button" class="chat-contact ${contact.unread_count ? 'unread' : ''}" data-user-id="${contact.id}"><span class="chat-contact-avatar ${contact.is_online ? 'is-online' : ''}">${avatar}</span><span><strong>@${escapeHtml(contact.username)}</strong><small>${escapeHtml(contact.latest_message || 'Start a conversation')}</small><time>${escapeHtml(formatRelativeTime(contact.latest_message_at))}</time></span></button>`;
    }).join('');
    const groupMarkup = (chatGroupCache || []).map((group) => `<button type="button" class="chat-contact chat-group-contact" data-group-id="${group.group_id}"><span class="chat-contact-avatar">${escapeHtml((group.name || 'G').slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.latest_message || `${group.member_count} members`)}</small><time>${escapeHtml(formatRelativeTime(group.latest_message_at))}</time></span></button>`).join('');
    list.innerHTML = `${groupMarkup}${contactMarkup}` || '<div class="bookmarks-empty">No contacts yet.</div>';
    await Promise.all([...list.querySelectorAll('.chat-contact')].map(async (item) => {
        const isGroup = item.classList.contains('chat-group-contact');
        const conversationId = isGroup ? item.dataset.groupId : item.dataset.userId;
        const source = (isGroup ? chatGroupCache : chatContactCache).find((entry) => String(isGroup ? entry.group_id : entry.id) === String(conversationId));
        const preview = await decryptChatPreview(source?.latest_message, isGroup ? { id: conversationId, group_id: conversationId, is_group: true } : { id: conversationId });
        const summary = item.querySelector('small');
        if (summary && preview) summary.textContent = preview;
    }));
    list.querySelectorAll('.chat-group-contact').forEach((item) => item.addEventListener('click', () => selectChatGroup(chatGroupCache.find((group) => String(group.group_id) === item.dataset.groupId))));
    list.querySelectorAll('.chat-contact:not(.chat-group-contact)').forEach((item) => item.addEventListener('click', () => selectChatContact(chatContactCache.find((contact) => String(contact.id) === item.dataset.userId))));
}

async function loadUnreadChatCount() {
    if (!localStorage.getItem('aero_token')) return;
    const response = await fetch(`${API_BASE}/chat/unread-count`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load unread messages');
    const unreadCount = Number(data.unread_count) || 0;
    if (chatUnreadCount !== null && unreadCount > chatUnreadCount) playNotificationSound();
    chatUnreadCount = unreadCount;
    updateDockBadge('chat-dock-btn', unreadCount + getLocalGroupUnreadCount());
}

async function markConversationRead(conversation) {
    if (!conversation) return;
    if (conversation.is_group) chatGroupUnreadCounts.delete(String(conversation.group_id || conversation.id));
    const payload = conversation.is_group
        ? { group_id: conversation.group_id || conversation.id }
        : { sender_id: conversation.id };
    const response = await fetch(`${API_BASE}/chat/messages/mark-read`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('aero_token')}`
        },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Unable to mark messages as read');
    updateDockBadge('chat-dock-btn', (data.unread_count || 0) + getLocalGroupUnreadCount());
    chatUnreadCount = Number(data.unread_count) || 0;
}

function setMuteButtonState(button, muted, animate = true) {
    if (!button) return;
    button.classList.toggle('is-muted', muted);
    button.setAttribute('aria-label', muted ? 'Unmute user' : 'Mute user');
    button.title = muted ? 'Unmute user' : 'Mute user';
    button.innerHTML = muted
        ? '<svg class="chat-header-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path><path d="m4 4 16 16"></path></svg>'
        : '<svg class="chat-header-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path></svg>';
    if (animate) {
        button.classList.remove('is-toggling');
        void button.offsetWidth;
        button.classList.add('is-toggling');
    }
}

function setChatContactState(isOpen) {
    const isMobile = window.innerWidth <= 768;
    const view = document.getElementById('view-chat');
    const backButton = document.getElementById('chat-back-btn') || document.getElementById('chat-back-button');
    view?.classList.toggle('chat-contact-open', Boolean(isOpen && isMobile));
    backButton?.classList.toggle('is-visible', Boolean(isOpen && isMobile));
}

async function selectChatGroup(group) {
    if (!group) return;
    activeChatUser = { ...group, id: group.group_id, is_group: true };
    window.activeChatUser = activeChatUser;
    setChatContactState(true);
    const activeAvatar = document.getElementById('chat-active-avatar');
    const activeName = document.getElementById('chat-active-name');
    const groupInfo = document.getElementById('chat-group-info-btn');
    if (activeName) activeName.textContent = `${group.name} · ${group.member_count} members`;
    if (activeAvatar) {
        activeAvatar.classList.remove('is-online');
        activeAvatar.replaceChildren();
        activeAvatar.textContent = String(group.name || 'G').slice(0, 1).toUpperCase();
    }
    groupInfo?.classList.remove('hidden');
    document.getElementById('chat-mute-btn')?.classList.add('hidden');
    const cacheKey = chatConversationKey(activeChatUser);
    const cachedMessages = messagesCache.get(cacheKey);
    if (cachedMessages) loadChatMessages({ contact: activeChatUser, messages: cachedMessages });
    else showChatMessagesSkeleton();
    loadChatMessages({ contact: activeChatUser });
}

async function selectChatContact(contact) {
    if (!contact) return;
    activeChatUser = contact;
    window.activeChatUser = contact;
    document.getElementById('chat-group-info-btn')?.classList.add('hidden');
    setChatContactState(true);
    const activeAvatar = document.getElementById('chat-active-avatar');
    const activeName = document.getElementById('chat-active-name');
    if (activeName) activeName.textContent = `@${contact.username}`;
    if (activeAvatar) {
        activeAvatar.classList.toggle('is-online', Boolean(contact.is_online));
        activeAvatar.replaceChildren();
        const avatarUrl = contact.avatar_url && !String(contact.avatar_url).startsWith('letter:')
            ? (String(contact.avatar_url).startsWith('http') ? contact.avatar_url : `${API_ORIGIN}${contact.avatar_url}`)
            : '';
        if (avatarUrl) {
            const image = document.createElement('img');
            image.src = avatarUrl;
            image.alt = `@${contact.username}`;
            image.onerror = () => { activeAvatar.textContent = (contact.username || 'U').charAt(0).toUpperCase(); };
            activeAvatar.appendChild(image);
        } else {
            activeAvatar.textContent = String(contact.avatar_url || '').startsWith('letter:')
                ? String(contact.avatar_url).slice(7, 8).toUpperCase()
                : (contact.username || 'U').charAt(0).toUpperCase();
        }
    }
    const cacheKey = chatConversationKey(contact);
    const cachedMessages = messagesCache.get(cacheKey);
    if (cachedMessages) {
        loadChatMessages({ contact, messages: cachedMessages, fromCache: true });
    } else {
        showChatMessagesSkeleton();
    }
    loadChatMessages({ contact });
    const muteButton = document.getElementById('chat-mute-btn');
    if (muteButton) {
        muteButton.classList.remove('hidden');
        setMuteButtonState(muteButton, Boolean(contact.is_muted), false);
    }
    loadChatContacts().catch(() => {});
    loadUnreadChatCount().catch(() => {});
}

window.selectChatContact = selectChatContact;

async function loadChatMessages() {
    const options = arguments[0] || {};
    const contact = options.contact || activeChatUser || window.activeChatUser;
    if (!contact) return;
    const cacheKey = chatConversationKey(contact);
    if (options.messages) {
        renderChatMessages(options.messages, contact);
        return;
    }
    if (chatLoadRequests.has(cacheKey)) return chatLoadRequests.get(cacheKey);
    const query = contact.is_group ? `group_id=${contact.group_id || contact.id}` : `contact_id=${contact.id}`;
    const request = (async () => {
    const response = await fetch(`${API_BASE}/chat/messages?${query}&limit=30`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
    const messages = await response.json();
    messagesCache.set(cacheKey, Array.isArray(messages) ? messages : []);
    if (chatConversationKey(activeChatUser || window.activeChatUser) !== cacheKey) return;
    renderChatMessages(messages, contact);
    markConversationRead(contact).catch(() => {});
    })();
    chatLoadRequests.set(cacheKey, request);
    try { await request; } finally { chatLoadRequests.delete(cacheKey); }
}

function chatConversationKey(contact) {
    return contact?.is_group
        ? `group:${contact.group_id || contact.id}`
        : `user:${contact?.id}`;
}

function showChatMessagesSkeleton() {
    const box = document.getElementById('chat-messages-list') || document.getElementById('chat-messages');
    if (!box) return;
    box.innerHTML = '<div class="chat-messages-skeleton" aria-live="polite"><span></span><span></span><span></span></div>';
}

async function renderChatMessages(messages, contact) {
    const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
    const snapshotKey = `${contact.is_group ? 'group' : 'user'}:${contact.id}`;
    const previousIds = chatMessageSnapshots.get(snapshotKey);
    const messageIds = new Set((messages || []).map((message) => String(message.id)));
    if (previousIds) {
        const hasNewIncomingMessage = (messages || []).some((message) => message.sender_id !== currentUser.id && !previousIds.has(String(message.id)));
        if (hasNewIncomingMessage) playNotificationSound();
    }
    chatMessageSnapshots.set(snapshotKey, messageIds);
    const box = document.getElementById('chat-messages-list') || document.getElementById('chat-messages');
    const displayMessages = await Promise.all((messages || []).map(async (message) => ({
        ...message,
        content: await decryptChatContent(message.content, contact)
    })));
    const formatBytes = (value) => { const size = Number(value) || 0; if (size < 1024) return `${size} B`; if (size < 1048576) return `${Math.round(size / 1024)} KB`; return `${(size / 1048576).toFixed(1)} MB`; };
    const mediaMarkup = (message) => {
        const url = message.media_url ? (String(message.media_url).startsWith('http') ? message.media_url : `${API_ORIGIN}${message.media_url}`) : '';
        if (!url) return '';
        if (message.type === 'image' || message.type === 'gif') return `<button type="button" class="chat-media-preview" data-lightbox-src="${escapeHtml(url)}"><img src="${escapeHtml(url)}" alt="Attached image" loading="lazy"></button>`;
        if (message.type === 'video') return `<video class="chat-inline-video" src="${escapeHtml(url)}" controls preload="metadata" playsinline crossorigin="anonymous"></video>`;
        if (message.type === 'audio') return `<audio class="chat-inline-audio" src="${escapeHtml(url)}" controls></audio>`;
        return `<a class="chat-document-card" href="${escapeHtml(url)}" download><span class="chat-document-ext">${escapeHtml((message.file_name || 'FILE').split('.').pop().slice(0, 5).toUpperCase())}</span><span><strong>${escapeHtml(message.file_name || 'Attached document')}</strong><small>${formatBytes(message.file_size)}</small></span><span class="chat-document-download" aria-hidden="true">↓</span></a>`;
    };
    const sharedPostMarkup = (post) => {
        if (!post) return '';
        const image = Array.isArray(post.images) && post.images[0]
            ? `<img src="${escapeHtml(String(post.images[0]).startsWith('http') ? post.images[0] : `${API_ORIGIN}${post.images[0]}`)}" alt="Shared post image" loading="lazy">`
            : '';
        return `<a class="chat-shared-post" href="/#post-${post.id}"><span class="chat-shared-post-author"><span class="chat-shared-post-avatar">${post.avatar_url ? `<img src="${escapeHtml(String(post.avatar_url).startsWith('http') ? post.avatar_url : `${API_ORIGIN}${post.avatar_url}`)}" alt="">` : escapeHtml((post.username || 'U').charAt(0).toUpperCase())}</span><strong>@${escapeHtml(post.username || 'User')}</strong></span>${image}<span class="chat-shared-post-text">${escapeHtml(post.content || 'Shared post')}</span></a>`;
    };
    const renderMessageText = (value) => escapeHtml(value).replace(/(https?:\/\/[^\s<]+|\/#post-\d+)/g, '<a class="chat-message-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    box.innerHTML = displayMessages.map((message) => `<div class="chat-message ${message.sender_id === currentUser.id ? 'mine' : ''}" data-message-id="${message.id}">${contact.is_group && message.sender_id !== currentUser.id ? `<small class="chat-group-sender">@${escapeHtml(message.sender_username || 'User')}</small>` : ''}<div class="chat-bubble-content">${message.shared_post ? sharedPostMarkup(message.shared_post) : mediaMarkup(message)}${message.type === 'post_share' ? '' : (message.content ? renderMessageText(message.content) : '')}</div><div class="chat-message-meta"><time>${escapeHtml(window.AeroI18n?.formatChatTimestamp?.(message.created_at) || '')}</time>${message.can_delete ? `<span class="chat-message-tools"><button type="button" data-delete-message="${message.id}" aria-label="Delete message">Delete</button></span>` : ''}</div></div>`).join('');
    box.querySelectorAll('[data-lightbox-src]').forEach((item) => item.addEventListener('click', () => { const lightbox = document.getElementById('chat-lightbox'); const image = document.getElementById('chat-lightbox-image'); image.src = item.dataset.lightboxSrc; lightbox.classList.remove('hidden'); }));
    box.querySelectorAll('[data-delete-message]').forEach((button) => button.addEventListener('click', async () => { const response = await fetch(`${API_BASE}/chat/messages/${button.dataset.deleteMessage}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } }); if (response.ok) button.closest('.chat-message')?.remove(); }));
    box.scrollTop = box.scrollHeight;
}

function setupMediaAndChat() {
    document.getElementById('chat-dock-btn')?.addEventListener('click', () => { setChatContactState(false); window.AeroRouter?.navigate('chat'); loadChatContacts(); });
    document.getElementById('chat-back-btn')?.addEventListener('click', () => {
        setChatContactState(false);
    });
    document.getElementById('chat-back-button')?.addEventListener('click', () => setChatContactState(false));
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) setChatContactState(false);
    }, { passive: true });
    if (localStorage.getItem('aero_token')) {
        loadChatContacts();
        loadUnreadChatCount().catch(() => {});
        setupChatRealtime();
    }
    document.getElementById('close-chat-drawer')?.addEventListener('click', () => { document.getElementById('view-chat').classList.add('hidden'); });
    document.getElementById('chat-contact-search')?.addEventListener('input', (event) => document.querySelectorAll('.chat-contact').forEach((item) => item.classList.toggle('hidden', !item.textContent.toLowerCase().includes(event.target.value.toLowerCase()))));
    const newGroupModal = document.getElementById('chat-new-group-modal');
    const membersModal = document.getElementById('chat-group-members-modal');
    const closeModal = (modal) => modal?.classList.add('hidden');
    const renderGroupPicker = () => {
        const picker = document.getElementById('chat-group-contact-picker');
        if (!picker) return;
        picker.innerHTML = chatContactCache.length
            ? chatContactCache.map((contact) => `<label class="chat-group-contact-option"><input type="checkbox" value="${contact.id}"><span class="chat-contact-avatar">${escapeHtml((contact.username || 'U').slice(0, 1).toUpperCase())}</span><span>@${escapeHtml(contact.username)}</span></label>`).join('')
            : '<p class="bookmarks-empty">Follow or connect with people before creating a group.</p>';
    };
    document.getElementById('chat-new-group-btn')?.addEventListener('click', async () => {
        await loadChatContacts();
        renderGroupPicker();
        document.getElementById('chat-group-name').value = '';
        document.getElementById('chat-group-feedback').textContent = '';
        newGroupModal?.classList.remove('hidden');
        document.getElementById('chat-group-name')?.focus();
    });
    ['chat-new-group-close', 'chat-new-group-cancel'].forEach((id) => document.getElementById(id)?.addEventListener('click', () => closeModal(newGroupModal)));
    newGroupModal?.addEventListener('click', (event) => { if (event.target === newGroupModal) closeModal(newGroupModal); });
    document.getElementById('chat-new-group-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = document.getElementById('chat-group-name').value.trim();
        const memberIds = [...document.querySelectorAll('#chat-group-contact-picker input:checked')].map((input) => Number(input.value));
        const feedback = document.getElementById('chat-group-feedback');
        try {
            const response = await fetch(`${API_BASE}/chat/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }, body: JSON.stringify({ name, member_ids: memberIds }) });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Unable to create group');
            closeModal(newGroupModal);
            await loadChatContacts();
            await selectChatGroup(data);
        } catch (error) { if (feedback) feedback.textContent = error.message; }
    });
    const openGroupMembers = async () => {
        const group = activeChatUser;
        if (!group?.is_group) return;
        const response = await fetch(`${API_BASE}/chat/groups/${group.group_id || group.id}/members`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return window.showNotice?.(data.message || 'Unable to load group members.', 'error');
        document.getElementById('chat-group-members-title').textContent = data.group.name;
        document.getElementById('chat-group-member-count').textContent = `${data.members.length} members`;
        document.getElementById('chat-group-members-list').innerHTML = data.members.map((member) => `<div class="chat-group-member"><span class="chat-contact-avatar">${escapeHtml((member.username || 'U').slice(0, 1).toUpperCase())}</span><span><strong>@${escapeHtml(member.username)}</strong>${member.is_admin ? '<small>Group admin</small>' : ''}</span></div>`).join('');
        const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
        const isOwner = Number(data.group.owner_id) === Number(currentUser.id);
        document.getElementById('chat-group-delete-btn')?.classList.toggle('hidden', !isOwner);
        document.getElementById('chat-group-leave-btn')?.classList.toggle('hidden', isOwner);
        membersModal?.classList.remove('hidden');
    };
    document.getElementById('chat-active-name')?.addEventListener('click', openGroupMembers);
    document.getElementById('chat-group-info-btn')?.addEventListener('click', openGroupMembers);
    document.getElementById('chat-group-members-close')?.addEventListener('click', () => closeModal(membersModal));
    membersModal?.addEventListener('click', (event) => { if (event.target === membersModal) closeModal(membersModal); });
    document.getElementById('chat-group-delete-btn')?.addEventListener('click', async () => {
        const group = activeChatUser;
        if (!group) return;
        const response = await fetch(`${API_BASE}/chat/groups/${group.group_id || group.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
        if (!response.ok) return;
        closeModal(membersModal);
        activeChatUser = null;
        document.getElementById('chat-messages-list').replaceChildren();
        document.getElementById('chat-active-name').textContent = 'Select a contact';
        document.getElementById('chat-group-info-btn')?.classList.add('hidden');
        await loadChatContacts();
    });
    document.getElementById('chat-group-leave-btn')?.addEventListener('click', async () => {
        const group = activeChatUser;
        if (!group) return;
        const response = await fetch(`${API_BASE}/chat/groups/${group.group_id || group.id}/leave`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
        if (!response.ok) return;
        closeModal(membersModal);
        activeChatUser = null;
        document.getElementById('chat-messages-list').replaceChildren();
        document.getElementById('chat-active-name').textContent = 'Select a contact';
        document.getElementById('chat-group-info-btn')?.classList.add('hidden');
        await loadChatContacts();
    });
    const getChatInput = () => document.getElementById('chat-input') || document.getElementById('chat-message-input');
    const attachButton = document.getElementById('chat-attach-btn');
    const fileInput = document.getElementById('chat-file-input');
    const attachmentMenu = document.getElementById('chat-attachment-menu');
    const muteButton = document.getElementById('chat-mute-btn');
    muteButton?.addEventListener('click', async () => {
        const contact = activeChatUser || window.activeChatUser;
        if (!contact) return;
        const muted = muteButton.classList.contains('is-muted');
        const response = await fetch(`${API_BASE}/chat/contacts/${contact.id}/mute`, {
            method: muted ? 'DELETE' : 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        if (!response.ok) return;
        contact.is_muted = !muted;
        setMuteButtonState(muteButton, !muted);
        await loadChatContacts();
    });
    attachButton?.addEventListener('click', () => attachmentMenu?.classList.toggle('hidden'));
    attachmentMenu?.addEventListener('click', (event) => { const button = event.target.closest('[data-attachment-kind]'); if (!button) return; fileInput.accept = button.dataset.attachmentKind === 'media' ? 'image/*,video/*' : button.dataset.attachmentKind === 'document' ? '.pdf,.txt,.doc,.docx,.xls,.xlsx' : 'image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx'; attachmentMenu.classList.add('hidden'); fileInput.click(); });
    fileInput?.addEventListener('change', () => fileInput.files[0] && window.selectChatAttachment?.(fileInput.files[0]));
    window.selectChatAttachment = async (file) => { const formData = new FormData(); formData.append('file', file); const response = await fetch(`${API_BASE}/chat/uploads`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }, body: formData }); const data = await response.json().catch(() => ({})); if (!response.ok) { window.showNotice?.(data.message || 'Unable to upload attachment.', 'error'); return; } const input = getChatInput(); input.dataset.mediaUrl = data.url; input.dataset.messageType = data.type; input.dataset.fileName = data.file_name; input.dataset.fileSize = data.file_size; input.placeholder = data.file_name; input.focus(); };
    document.getElementById('chat-lightbox-close')?.addEventListener('click', () => document.getElementById('chat-lightbox')?.classList.add('hidden'));
    document.getElementById('chat-emoji-btn')?.addEventListener('click', () => { const input = getChatInput(); if (!input) return; input.value += ' 😊'; input.focus(); });
    const chatGifUrls = ['https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif', 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif'];
    document.getElementById('chat-gif-btn')?.addEventListener('click', () => {
        const input = getChatInput();
        if (!input) return;
        const picker = document.createElement('div');
        picker.className = 'chat-gif-picker';
        picker.innerHTML = chatGifUrls.map((url) => `<button type="button" data-gif-url="${url}"><img src="${url}" alt="GIF"></button>`).join('');
        document.getElementById('chat-form')?.appendChild(picker);
        picker.addEventListener('click', (event) => {
            const button = event.target.closest('[data-gif-url]');
            if (!button) return;
            input.dataset.mediaUrl = button.dataset.gifUrl;
            input.dataset.messageType = 'gif';
            input.value = '';
            picker.remove();
            input.focus();
        });
    });
    document.getElementById('chat-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const input = getChatInput();
        const contact = activeChatUser || window.activeChatUser;
        const content = input?.value.trim();
        const mediaUrl = input?.dataset.mediaUrl || '';
        const messageType = input?.dataset.messageType || 'text';
        if (!contact || (!content && !mediaUrl)) return;
        const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
        const temporaryId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const groupId = contact.is_group ? contact.group_id || contact.id : null;
        const fileName = input.dataset.fileName || '';
        const fileSize = input.dataset.fileSize || 0;
        const temporaryMessage = {
            id: temporaryId,
            content,
            media_url: mediaUrl,
            type: messageType,
            file_name: fileName,
            file_size: fileSize,
            sender_id: currentUser.id,
            recipient_id: contact.is_group ? currentUser.id : contact.id,
            group_id: groupId,
            created_at: new Date().toISOString(),
            status: 'sending'
        };
        input.value = '';
        ['mediaUrl', 'messageType', 'fileName', 'fileSize'].forEach((key) => delete input.dataset[key]);
        input.placeholder = 'Message...';
        const conversationCache = messagesCache.get(chatConversationKey(contact));
        if (conversationCache) conversationCache.push(temporaryMessage);
        await appendSingleMessageToUI(temporaryMessage, contact);

        const temporaryNode = () => document.querySelector(`[data-message-id="${temporaryId}"]`);
        const requestMessage = async () => {
            const encryptedContent = await encryptChatContent(content, contact);
            const body = contact.is_group
                ? { group_id: groupId, content: encryptedContent, media_url: mediaUrl, type: messageType, file_name: fileName, file_size: fileSize }
                : { user_id: contact.id, recipient_id: contact.id, content: encryptedContent, media_url: mediaUrl, type: messageType, file_name: fileName, file_size: fileSize };
            const response = await fetch(`${API_BASE}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` },
                body: JSON.stringify(body)
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || payload.error || 'Unable to send message');
            return { ...payload, content: encryptedContent };
        };
        const sendAndSettle = async () => {
            try {
                const savedMessage = await requestMessage();
                const renderedMessage = {
                    ...savedMessage,
                    sender_id: currentUser.id,
                    recipient_id: contact.is_group ? currentUser.id : contact.id,
                    group_id: groupId,
                    created_at: savedMessage.created_at || new Date().toISOString(),
                    status: 'sent'
                };
                const cached = messagesCache.get(chatConversationKey(contact));
                if (cached) {
                    const index = cached.findIndex((message) => message.id === temporaryId);
                    if (index >= 0) cached.splice(index, 1, renderedMessage);
                    else cached.push(renderedMessage);
                }
                temporaryNode()?.remove();
                await appendSingleMessageToUI(renderedMessage, contact);
                updateChatContactPreview(renderedMessage, content || '[Attachment]', contact);
                await markConversationRead(contact).catch(() => {});
                await loadUnreadChatCount().catch(() => {});
            } catch (error) {
                const node = temporaryNode();
                if (!node) return;
                node.classList.remove('is-sending');
                node.classList.add('is-failed');
                const meta = node.querySelector('.chat-message-meta');
                if (meta) {
                    meta.querySelector('.chat-delivery-status')?.remove();
                    const failed = document.createElement('span');
                    failed.className = 'chat-delivery-status failed';
                    failed.textContent = 'Failed, retry';
                    failed.addEventListener('click', () => {
                        node.classList.remove('is-failed');
                        node.classList.add('is-sending');
                        failed.textContent = 'Sending...';
                        sendAndSettle();
                    }, { once: true });
                    meta.appendChild(failed);
                }
                window.showNotice?.(error.message || 'Unable to send message. Tap retry.', 'error');
            }
        };
        sendAndSettle();
    });
    document.getElementById('chat-form')?.addEventListener('dragover', (event) => event.preventDefault());
    document.getElementById('chat-form')?.addEventListener('drop', (event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) window.selectChatAttachment(file); });
}

function createBookmarkAvatarMarkup(post, authorName) {
    authorName = String(authorName || 'User');
    return renderAvatarMarkup({
        username: authorName,
        avatar_url: post.avatar_url || post.author_avatar || post.user?.avatar_url || ''
    }, 'post-avatar');
}

function createBookmarkItemMarkup(post) {
    const authorName = post.username || 'User';
    const excerpt = (post.content || '').trim() || 'Saved post';
    const createdAt = formatRelativeTime(post.created_at);
    return `
        <article class="bookmark-item" data-bookmark-id="${post.id}" tabindex="0" role="button" aria-label="Open post by @${escapeHtml(authorName)}">
            <span class="bookmark-item-avatar" aria-hidden="true">${createBookmarkAvatarMarkup(post, authorName)}</span>
            <div class="bookmark-item-content">
                <div class="bookmark-item-header">
                    <span class="bookmark-item-author">@${escapeHtml(authorName)}</span>
                    <div class="bookmark-item-meta"><span class="bookmark-item-time">${createdAt}</span><button type="button" class="bookmark-item-remove" data-bookmark-id="${post.id}" aria-label="Remove bookmark">×</button></div>
                </div>
                <p class="bookmark-item-text">${escapeHtml(excerpt)}</p>
            </div>
        </article>
    `;
}

const trendingGifs = [
    { name: 'Celebrate', url: 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif' },
    { name: 'Happy', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif' },
    { name: 'Applause', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
    { name: 'Laugh', url: 'https://media.giphy.com/media/10t57cXgo7x5kI/giphy.gif' },
    { name: 'Wow', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
    { name: 'Love', url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif' }
];

function renderGifPicker(popover, query, onSelect) {
    const results = trendingGifs.filter((gif) => gif.name.toLowerCase().includes(query.toLowerCase()));
    popover.querySelector('.gif-picker-grid').innerHTML = results.length
        ? results.map((gif) => `<button type="button" class="gif-picker-item" data-gif-url="${gif.url}"><img src="${gif.url}" alt="${escapeHtml(gif.name)}" loading="lazy"></button>`).join('')
        : '<p class="gif-picker-empty">No GIFs found.</p>';
    popover.querySelectorAll('.gif-picker-item').forEach((item) => item.addEventListener('click', () => onSelect(item.dataset.gifUrl)));
}

function setupGifPicker(composer, onSelect) {
    const button = composer.querySelector('.comment-media-btn');
    const shell = composer.querySelector('.comment-input-shell');
    if (!button || !shell) return;
    const popover = document.createElement('div');
    popover.className = 'gif-picker-popover hidden';
    popover.innerHTML = '<input class="gif-picker-search" type="search" placeholder="Search GIFs" aria-label="Search GIFs"><div class="gif-picker-grid"></div>';
    shell.appendChild(popover);
    const close = () => popover.classList.add('hidden');
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        popover.classList.toggle('hidden');
        if (!popover.classList.contains('hidden')) {
            renderGifPicker(popover, '', onSelect);
            popover.querySelector('.gif-picker-search').focus();
        }
    });
    popover.querySelector('.gif-picker-search').addEventListener('input', (event) => renderGifPicker(popover, event.target.value, onSelect));
    document.addEventListener('click', (event) => { if (!popover.contains(event.target) && event.target !== button) close(); });
}

async function loadBookmarksDrawer() {
    const list = document.getElementById('bookmarks-list');
    if (!list) return;

    list.innerHTML = `<div class="bookmarks-empty"><div class="bookmarks-empty-icon">★</div><div>${window.AeroI18n?.translateValue('Loading...') || 'Loading...'}</div></div>`;
    try {
        const posts = await AeroAPI.getBookmarkedPosts();
        if (!posts || posts.length === 0) {
            list.innerHTML = `
                <div class="bookmarks-empty">
                    <div class="bookmarks-empty-icon">☆</div>
                    <div>${window.AeroI18n?.t('no_bookmarks') || 'No bookmarks'}</div>
                </div>
            `;
            return;
        }

        list.innerHTML = posts.map(createBookmarkItemMarkup).join('');
        list.querySelectorAll('.bookmark-item').forEach((item) => {
            const openPost = () => openBookmarkedPost(Number(item.dataset.bookmarkId));
            item.addEventListener('click', (event) => {
                if (event.target.closest('.bookmark-item-remove')) return;
                openPost();
            });
            item.addEventListener('keydown', (event) => {
                if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.bookmark-item-remove')) {
                    event.preventDefault();
                    openPost();
                }
            });
        });
        list.querySelectorAll('.bookmark-item-remove').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                const postId = Number(button.dataset.bookmarkId);
                const item = button.closest('.bookmark-item');
                if (!item || Number.isNaN(postId)) return;
                item.classList.add('fade-out');
                try {
                    const result = await AeroAPI.toggleBookmark(postId);
                    if (result.bookmarked) {
                        item.classList.remove('fade-out');
                        return;
                    }
                    window.setTimeout(() => {
                        item.remove();
                        if (!list.querySelector('.bookmark-item')) {
                            list.innerHTML = `
                                <div class="bookmarks-empty">
                                    <div class="bookmarks-empty-icon">☆</div>
                                    <div>${window.AeroI18n?.t('no_bookmarks') || 'No bookmarks'}</div>
                                </div>
                            `;
                        }
                    }, 220);

                    showNotice('Bookmark removed.', 'success', {
                        actionLabel: 'Undo',
                        onAction: async () => {
                            await AeroAPI.toggleBookmark(postId);
                            await loadBookmarksDrawer();
                            await AeroAPI.renderFeed();
                        }
                    });
                    await AeroAPI.renderFeed();
                } catch (error) {
                    item.classList.remove('fade-out');
                    showNotice(error.message, 'error');
                }
            });
        });
    } catch (error) {
        list.innerHTML = `
            <div class="bookmarks-empty">
                <div class="bookmarks-empty-icon">!</div>
                <div>${escapeHtml(error.message || 'Unable to load bookmarks.')}</div>
            </div>
        `;
    }
}

async function openBookmarkedPost(postId) {
    if (!Number.isInteger(postId) || postId <= 0) return;
    setBookmarkDrawerVisibility(false);
    let postElement = document.querySelector(`#posts-feed [data-post-id="${postId}"]`);
    if (!postElement) {
        try {
            await AeroAPI.renderFeed();
            postElement = document.querySelector(`#posts-feed [data-post-id="${postId}"]`);
        } catch (error) {
            showNotice(error.message || 'Unable to open bookmarked post.', 'error');
            return;
        }
    }
    if (postElement) {
        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        postElement.classList.add('bookmark-focus');
        window.setTimeout(() => postElement.classList.remove('bookmark-focus'), 1200);
    } else {
        showNotice('This post is no longer available.', 'info');
    }
}

function closeNotice(overlay) {
    if (!overlay || overlay.classList.contains('is-closing')) return;
    overlay.classList.add('is-closing');
    window.setTimeout(() => overlay.classList.add('hidden'), 240);
}

const AeroAPI = {
    // Auth API
    async signin(username, password) {
        try {
            const res = await fetch(`${API_BASE}/auth/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('aero_token', data.token);
                localStorage.setItem('aero_user', JSON.stringify(data.user));
                window.AeroI18n?.restoreUserLanguage?.(data.user);
                window.location.href = 'index.html?tab=for_you';
                return;
            } else {
                if (data.suspended) {
                    sessionStorage.setItem('aero_suspended_username', data.username || username);
                    window.location.href = 'suspended.html';
                    return;
                }
                showNotice(data.message || 'Sign in failed', 'error');
            }
        } catch (err) {
            console.error('API Error:', err);
            showNotice('Unable to connect to Aero right now.', 'error');
        }
    },

    async signup(username, email, password, confirmPassword = password) {
        try {
            const res = await fetch(`${API_BASE}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, confirm_password: confirmPassword })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                sessionStorage.setItem('aero_pending_email', email);
                window.location.href = 'otp.html';
            } else {
                showNotice(data.message || 'Sign up failed', 'error');
            }
        } catch (err) {
            console.error('API Error:', err);
            showNotice('Unable to connect to Aero right now.', 'error');
        }
    },

    async verifyOTP(email, code) {
        try {
            const res = await fetch(`${API_BASE}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('aero_token', data.token);
                localStorage.setItem('aero_user', JSON.stringify(data.user));
                window.AeroI18n?.restoreUserLanguage?.(data.user);
                sessionStorage.setItem('aero_profile_onboarding', '1');
                window.location.href = 'index.html';
            } else {
                showNotice(data.message || 'OTP verification failed', 'error');
            }
        } catch (err) {
            console.error('API Error:', err);
            showNotice('Unable to connect to Aero right now.', 'error');
        }
    },

    async updateProfile(profile) {
        const res = await fetch(`${API_BASE}/users/me/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('aero_token')}`
            },
            body: JSON.stringify(profile)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to update profile');
        const previous = JSON.parse(localStorage.getItem('aero_user') || '{}');
        const user = { ...previous, ...data.user };
        localStorage.setItem('aero_user', JSON.stringify(user));
        syncCurrentUserAvatars(user);
        renderHeaderNav(user);
        window.dispatchEvent(new CustomEvent('aero:user-updated', { detail: user }));
        return user;
    },

    // Resend OTP
    async resendOTP(email) {
        try {
            const res = await fetch(`${API_BASE}/auth/resend-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            showNotice(data.message || 'A new verification code was sent.', res.ok ? 'success' : 'error');
        } catch (err) {
            console.error('API Error:', err);
            showNotice('Unable to connect to Aero right now.', 'error');
        }
    },

    // Post CRUD API
    async fetchPosts(feedType = 'for_you', cursor = '') {
        try {
            const type = feedType === 'following' ? 'following' : 'for_you';
            const params = new URLSearchParams({ feed_type: type, limit: '10' });
            if (cursor) params.set('cursor', cursor);
            const res = await fetch(`${API_BASE}/posts?${params.toString()}`, {
                headers: authHeaders()
            });
            const payload = await res.json();
            return Array.isArray(payload) ? { posts: payload, next_cursor: null, has_more: false } : payload;
        } catch (err) {
            return { posts: [], next_cursor: null, has_more: false };
        }
    },

    async createPost(content, images = []) {
        try {
            const res = await fetch(`${API_BASE}/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('aero_token')}`
                },
                body: JSON.stringify({ content, images })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Unable to create post');
            return data;
        } catch (err) {
            console.error(err);
        }
    },

    async uploadMedia(file) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/uploads`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Media upload failed');
        return String(data.url || '').startsWith('http') ? data.url : `${API_ORIGIN}${data.url}`;
    },

    async deletePost(postId) {
        if (!requireAuth(null, 'Please sign in before deleting a post.')) return null;
        const res = await fetch(`${API_BASE}/posts/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Unable to delete post');
        }
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            postElement.classList.add('post-removing');
            window.setTimeout(() => postElement.remove(), 240);
        }
    },

    async submitReport(targetId, reason, targetType = 'post') {
        if (!requireAuth(null, 'Please sign in before reporting a post.')) return null;
        const res = await fetch(`${API_BASE}/reports`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('aero_token')}`
            },
            body: JSON.stringify({ target_type: targetType, target_id: targetId, reason })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to submit report');
        return data;
    },

    async getAdminStats() {
        try {
            const token = localStorage.getItem('aero_token') || localStorage.getItem('token');
            const res = await fetch(`${ADMIN_API_BASE}/stats`, {
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.success === false) {
                if ([404, 500, 502, 503, 504].includes(res.status)) return { ...DEFAULT_ADMIN_STATS };
                throw new Error(data.error || data.message || 'Unable to load admin statistics');
            }
            return { ...DEFAULT_ADMIN_STATS, ...(data.data || {}) };
        } catch (error) {
            if (error instanceof TypeError) return { ...DEFAULT_ADMIN_STATS };
            throw error;
        }
    },

    async searchAdminUsers(query, signal) {
        const token = localStorage.getItem('aero_token') || localStorage.getItem('token');
        if (!String(query || '').trim()) return [];
        const requestController = new AbortController();
        const abortRequest = () => requestController.abort();
        const timeoutId = window.setTimeout(abortRequest, 8000);
        signal?.addEventListener('abort', abortRequest, { once: true });
        try {
            const response = await fetch(`${ADMIN_API_BASE}/users?q=${encodeURIComponent(String(query).trim())}`, {
                signal: requestController.signal,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.success === false) return [];
            const data = payload.data || payload;
            return Array.isArray(data) ? data : Array.isArray(data.users) ? data.users : [];
        } catch (error) {
            if (error.name !== 'AbortError') console.warn('[Aero admin user search]', error);
            return [];
        } finally {
            window.clearTimeout(timeoutId);
            signal?.removeEventListener('abort', abortRequest);
        }
    },

    async getAdminReports() {
        const res = await fetch(`${ADMIN_API_BASE}/reports`, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token') || localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (!res.ok || data.success === false) throw new Error(data.error || data.message || 'Unable to load reports');
        return data.data;
    },

    async adminDeletePost(postId) {
        const res = await fetch(`${ADMIN_API_BASE}/posts/${postId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token') || localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (!res.ok || data.success === false) throw new Error(data.error || data.message || 'Unable to delete post');
        return data.data;
    },

    async adminToggleBan(userId) {
        const res = await fetch(`${ADMIN_API_BASE}/users/${userId}/toggle_ban`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token') || localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (!res.ok || data.success === false) throw new Error(data.error || data.message || 'Unable to update user status');
        return data.data;
    },

    showReportModal(postId) {
        let overlay = document.getElementById('report-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'report-modal-overlay';
            overlay.className = 'report-modal-overlay';
            overlay.innerHTML = `<div class="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
                <div class="report-modal-header"><h2 id="report-modal-title">${window.AeroI18n?.t('report_post_title') || 'Report post'}</h2><button type="button" class="report-close" aria-label="Close report dialog">&times;</button></div>
                <form class="report-form"><label for="report-reason">${window.AeroI18n?.t('report_reason_prompt') || 'Tell us what is wrong...'}</label><textarea id="report-reason" maxlength="1000" required placeholder="${window.AeroI18n?.t('report_reason_prompt') || 'Tell us what is wrong...'}"></textarea><div class="report-form-actions"><button type="button" class="report-cancel-btn">Cancel</button><button type="submit" class="report-submit-btn">${window.AeroI18n?.t('submit_report') || 'Submit report'}</button></div></form>
            </div>`;
            document.body.appendChild(overlay);
            const close = () => overlay.classList.remove('is-open');
            overlay.querySelector('.report-close').addEventListener('click', close);
            overlay.querySelector('.report-cancel-btn').addEventListener('click', close);
            overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        }
        const form = overlay.querySelector('.report-form');
        const reasonInput = overlay.querySelector('#report-reason');
        form.onsubmit = async event => {
            event.preventDefault();
            const reason = reasonInput.value.trim();
            if (!reason) return;
            try {
                await this.submitReport(postId, reason);
                overlay.classList.remove('is-open');
                reasonInput.value = '';
                showNotice('Report submitted successfully.', 'success');
            } catch (error) {
                showNotice(error.message, 'error');
            }
        };
        overlay.classList.add('is-open');
        reasonInput.focus();
    },

    async likePost(postId) {
        if (!requireAuth(null, 'Please sign in before liking a post.')) return null;
        const res = await fetch(`${API_ORIGIN}/interact/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to like post');
        return data;
    },

    async cancelLikePost(postId) {
        if (!requireAuth(null, 'Please sign in before changing a like.')) return null;
        const res = await fetch(`${API_ORIGIN}/interact/posts/${postId}/like`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to remove like');
        return data;
    },

    async toggleFollow(userId, userMeta = {}) {
        if (!requireAuth(null, 'Please sign in before following someone.')) return null;
        const res = await fetch(`${API_BASE}/social/follow/${userId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to update follow status');
        if (data.is_following) {
            window.addContactToChatList?.({
                id: userId,
                name: userMeta.name || userMeta.username || 'User',
                username: userMeta.username || userMeta.name || 'User',
                avatar: userMeta.avatar || userMeta.avatar_url || ''
            });
        }
        return data;
    },

    async repostPost(postId, type = 'repost', content = '') {
        const res = await fetch(`${API_BASE}/posts/${postId}/repost`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` },
            body: JSON.stringify({ type, content })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to repost');
        return data;
    },

    async toggleBookmark(postId) {
        if (!requireAuth(null, 'Please sign in before saving a post.')) return null;
        const res = await fetch(`${API_BASE}/posts/${postId}/bookmark`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to update bookmark');
        return data;
    },

    async getBookmarkedPosts() {
        const res = await fetch(`${API_BASE}/posts/bookmarked`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to load bookmarks');
        return Array.isArray(data) ? data : [];
    },

    async markNotInterested(postId) {
        const res = await fetch(`${API_BASE}/recommendations/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` },
            body: JSON.stringify({ postId, feedback: 'not_interested' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to update recommendations');
        return data;
    },

    async recordShareStats(postId, action = 'share') {
        const res = await fetch(`${API_BASE}/posts/${postId}/share-stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` },
            body: JSON.stringify({ action })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to record share');
        return data;
    },

    async sendPostToUser(postId, recipientId, username = '') {
        const res = await fetch(`${API_BASE}/posts/${postId}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` },
            body: JSON.stringify({ recipient_id: Number(recipientId), username, type: 'post_share', post_id: Number(postId), content: '' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to share with user');
        return data;
    },

    async getComments(postId) {
        const res = await fetch(`${API_ORIGIN}/interact/posts/${postId}/comments`, {
            headers: authHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to load comments');
        return data.comments || [];
    },

    async sendComment(postId, content, parentId = null, imageUrl = '') {
        if (!requireAuth(null, 'Please sign in before commenting.')) return null;
        const res = await fetch(`${API_ORIGIN}/interact/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('aero_token')}`
            },
            body: JSON.stringify({ content, parentId, image_url: imageUrl })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to send comment');
        return data;
    },

    async toggleCommentLike(commentId, liked) {
        if (!requireAuth(null, 'Please sign in before liking a comment.')) return null;
        const res = await fetch(`${API_BASE}/comments/${commentId}/like`, {
            method: liked ? 'DELETE' : 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to update comment like');
        return data;
    },

    async deleteComment(commentId) {
        const res = await fetch(`${API_ORIGIN}/interact/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to delete comment');
        return data;
    },

    // Feed rendering and DOM updates
    async renderFeed(feedType = 'for_you', append = false) {
        const feedContainer = document.getElementById('posts-feed');
        if (!feedContainer) return;

        if (feedLoading) return;
        feedLoading = true;
        if (!append) {
            feedCursor = '';
            feedHasMore = true;
            feedTypeState = feedType;
            feedLoadObserver?.disconnect();
            feedContainer.innerHTML = '';
        } else {
            document.getElementById('feed-load-sentinel')?.remove();
        }
        const requestId = ++feedRenderRequestId;
        const payload = await this.fetchPosts(feedType, append ? feedCursor : '');
        feedLoading = false;
        if (requestId !== feedRenderRequestId) return;
        const posts = Array.isArray(payload.posts) ? payload.posts : [];
        feedCursor = payload.next_cursor || '';
        feedHasMore = Boolean(payload.has_more && feedCursor);
        const uniquePosts = [];
        const seenPostIds = new Set();
        (Array.isArray(posts) ? posts : []).forEach((post) => {
            const postId = Number(post?.id);
            if (!Number.isInteger(postId) || seenPostIds.has(postId)) return;
            seenPostIds.add(postId);
            uniquePosts.push(post);
        });

        if (uniquePosts.length === 0 && !append) {
            feedContainer.innerHTML = `<div class="post-card glass-card text-center"><p>No posts available yet.</p></div>`;
            return;
        }
        if (uniquePosts.length === 0) return;

        const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
        uniquePosts.forEach(post => {
            const postEl = document.createElement('div');
            postEl.className = 'post-card glass-card liquid-glass liquid-glass-interactive pop-in g2-card';
            postEl.dataset.postId = String(post.id);
            const recordPostView = () => window.ViewHistory?.recordViewedPost(post);
            postEl.addEventListener('click', (event) => {
                if (!event.target.closest('button, a, input, textarea, video')) recordPostView();
            });
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    if (entries.some((entry) => entry.isIntersecting)) {
                        recordPostView();
                        observer.disconnect();
                    }
                }, { threshold: 0.6 });
                observer.observe(postEl);
                if (feedTypeState === 'for_you' && localStorage.getItem('aero_token')) {
                    let dwellTimer;
                    let dwellRecorded = false;
                    const dwellObserver = new IntersectionObserver(([entry]) => {
                        if (entry.isIntersecting && !dwellRecorded && !dwellTimer) {
                            dwellTimer = window.setTimeout(() => {
                                dwellRecorded = true;
                                fetch(`${API_BASE}/posts/${post.id}/dwell`, {
                                    method: 'POST',
                                    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ seconds: 3 })
                                }).catch(() => {});
                            }, 3000);
                        } else if (!entry.isIntersecting && dwellTimer) {
                            window.clearTimeout(dwellTimer);
                            dwellTimer = null;
                        }
                    }, { threshold: 0.6 });
                    dwellObserver.observe(postEl);
                }
            }
            const header = document.createElement('div');
            header.className = 'post-header';
            const authorIdentity = document.createElement('div');
            authorIdentity.className = 'post-author-info post-author-identity';
            const profileLink = document.createElement('a');
            profileLink.className = 'post-author-link';
            profileLink.href = `#profile/${encodeURIComponent(post.user_id)}`;
            profileLink.setAttribute('aria-label', `Open @${post.username || 'User'} profile`);
            profileLink.addEventListener('click', (event) => {
                event.preventDefault();
                const userId = Number(post.user_id);
                if (Number.isInteger(userId) && userId > 0) {
                    window.navigateToUserProfile?.(userId);
                }
            });
            profileLink.appendChild(createAvatarElement(post.username, post.avatar_url, 'post-avatar', post.is_online));
            const author = document.createElement('span');
            author.className = 'post-author';
            author.innerHTML = `${escapeHtml(post.username || 'User')}${roleBadge(post.role)}`;
            profileLink.appendChild(author);
            authorIdentity.appendChild(profileLink);
            const postTime = document.createElement('time');
            postTime.className = 'post-relative-time';
            postTime.dateTime = post.created_at || '';
            postTime.textContent = formatRelativeTime(post.created_at);
            authorIdentity.appendChild(postTime);
            header.appendChild(authorIdentity);
            const moreButton = document.createElement('button');
            moreButton.className = 'icon-btn post-more-btn menu-trigger-btn';
            moreButton.type = 'button';
            moreButton.setAttribute('aria-label', 'Post options');
            moreButton.title = 'Post options';
            moreButton.textContent = '\u22ee';
            const optionsMenu = getGlobalPostMenu();
            const isOwnPost = post.user_id === currentUser.id;
            const isAdmin = currentUser.is_admin === true;
            const openDeleteModal = () => {
                const overlay = document.getElementById('delete-modal-overlay');
                if (!overlay) return;
                overlay.dataset.postId = String(post.id);
                overlay.classList.remove('hidden');
                document.getElementById('confirm-delete-btn')?.focus();
            };
            const populatePostMenu = () => {
                optionsMenu.replaceChildren();
                const addMenuItem = (label, iconPath, action, danger = false, translationKey = '') => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'menu-item';
                const rawLabel = label;
                if (translationKey) {
                    item.dataset.i18n = translationKey;
                    label = window.AeroI18n?.translateValue(translationKey) || label;
                }
                item.appendChild(createIcon(iconPath, label));
                const labelNode = document.createElement('span');
                labelNode.className = 'menu-item-label';
                if (translationKey) labelNode.dataset.i18nText = '';
                labelNode.textContent = label;
                item.append(' ', labelNode);
                const context = rawLabel.match(/\s@.+$/)?.[0];
                if (context) {
                    const contextNode = document.createElement('span');
                    contextNode.className = 'menu-item-context';
                    contextNode.textContent = context;
                    item.append(contextNode);
                }
                item.classList.toggle('danger', danger);
                if (translationKey === 'post.bookmark' || translationKey === 'post.remove_bookmark' || label === 'Bookmark Post' || label === 'Remove Bookmark') {
                    item.classList.add('bookmark-toggle-btn');
                    item.classList.toggle('is-bookmarked', Boolean(post.is_bookmarked));
                }
                item.addEventListener('click', () => {
                    closeAllPostMenus();
                    action();
                });
                    optionsMenu.appendChild(item);
                };
            addMenuItem(post.is_bookmarked ? 'Remove Bookmark' : 'Bookmark Post', '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3-6 3V4.5Z"></path>', async () => {
                try {
                    const menuButton = Array.from(optionsMenu.querySelectorAll('button')).find((button) => button.textContent.includes('Bookmark'));
                    menuButton?.classList.add('animate-pop');
                    setTimeout(() => menuButton?.classList.remove('animate-pop'), 220);
                    const result = await this.toggleBookmark(post.id);
                    post.is_bookmarked = result.bookmarked;
                    if (result.bookmarked) {
                        showNotice('Post bookmarked.', 'success');
                    } else {
                        showNotice('Bookmark removed.', 'success', {
                            actionLabel: 'Undo',
                            onAction: async () => {
                                const undoResult = await this.toggleBookmark(post.id);
                                post.is_bookmarked = undoResult.bookmarked;
                                await this.renderFeed();
                                await loadBookmarksDrawer();
                            }
                        });
                    }
                    await this.renderFeed();
                    if (!result.bookmarked) {
                        await loadBookmarksDrawer();
                    }
                } catch (error) { showNotice(error.message, 'error'); }
            }, false, post.is_bookmarked ? 'post.remove_bookmark' : 'post.bookmark');
            addMenuItem('Copy Link', '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"></path>', () => copyPostLink(post.id), false, 'post.copy_link');
            addMenuItem('Not Interested', '<path d="M4 4l16 16M20 4 4 20"></path>', async () => {
                postEl.classList.add('post-removing');
                try {
                    await this.markNotInterested(post.id);
                    window.setTimeout(() => postEl.remove(), 240);
                } catch (error) {
                    postEl.classList.remove('post-removing');
                    showNotice(error.message, 'error');
                }
            }, false, 'post.not_interested');
            const separator = document.createElement('div');
            separator.className = 'post-menu-separator';
            optionsMenu.appendChild(separator);
            if (!isOwnPost) {
                addMenuItem(`${post.is_following ? 'Unfollow' : 'Follow'} @${post.username || 'user'}`, '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M19 8v6M22 11h-6"></path>', async () => {
                    try {
                        const result = await this.toggleFollow(post.user_id, { username: post.username, name: post.username, avatar: post.avatar_url });
                        showNotice(result.is_following ? `Following @${post.username}.` : `Unfollowed @${post.username}.`, 'success');
                    } catch (error) { showNotice(error.message, 'error'); }
                }, false, post.is_following ? 'post.unfollow' : 'post.follow');
            }
            if (isAdmin || isOwnPost) addMenuItem(isAdmin && !isOwnPost ? 'Delete Post (Admin)' : 'Delete Post', '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path>', openDeleteModal, true);
                addMenuItem('Report Post', '<path d="M5 21V4m0 0c4-3 7 3 14 0v10c-7 3-10-3-14 0"></path>', () => this.showReportModal(post.id), true, 'post.report');
            };
            const menuWrapper = document.createElement('div');
            menuWrapper.className = 'post-menu-wrapper';
            moreButton.addEventListener('click', event => {
                event.stopPropagation();
                const shouldOpen = !optionsMenu.classList.contains('active') || optionsMenu.dataset.postId !== String(post.id);
                closeAllPostMenus();
                if (!shouldOpen) return;
                populatePostMenu();
                optionsMenu.dataset.postId = String(post.id);
                document.body.appendChild(optionsMenu);
                optionsMenu.classList.add('active');
                menuWrapper.classList.add('open');
                postEl.classList.add('menu-open');
                const rect = moreButton.getBoundingClientRect();
                optionsMenu.style.setProperty('top', `${rect.bottom + 4}px`, 'important');
                optionsMenu.style.setProperty('left', `${rect.right - optionsMenu.offsetWidth}px`, 'important');
            });
            menuWrapper.append(moreButton);
            header.appendChild(menuWrapper);
            const content = document.createElement('div');
            content.className = 'post-content';
            content.innerHTML = renderMentionText(post.content);
            postEl.append(header, content);
            if (post.images && post.images.length) {
                const media = document.createElement('div');
                const mediaList = post.images.filter(Boolean);
                media.className = `post-media-container${mediaList.length > 1 ? ' post-media-carousel' : ''}`;
                mediaList.forEach((mediaUrl, index) => {
                    const isVideo = /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(mediaUrl);
                    if (isVideo) {
                        const playButton = document.createElement('button');
                        playButton.type = 'button';
                        playButton.className = 'post-media-item post-video-placeholder';
                        playButton.setAttribute('aria-label', `Play video ${index + 1} of ${mediaList.length}`);
                        playButton.innerHTML = '<span class="post-video-placeholder-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg></span><span class="post-video-placeholder-label">Play video</span>';
                        playButton.addEventListener('click', event => { event.stopPropagation(); window.openThreadsMediaViewer(mediaList, index); });
                        media.appendChild(playButton);
                    } else {
                        const mediaElement = document.createElement('img');
                        mediaElement.className = 'post-media-item';
                        mediaElement.alt = 'Post media';
                        mediaElement.loading = 'lazy';
                        mediaElement.tabIndex = 0;
                        mediaElement.setAttribute('role', 'button');
                        mediaElement.setAttribute('aria-label', `Open media ${index + 1} of ${mediaList.length}`);
                        mediaElement.dataset.hdrFallback = String(!window.AeroMediaCapabilities?.isHDRSupported());
                        mediaElement.src = mediaUrl;
                        const openMedia = () => window.openThreadsMediaViewer(mediaList, index);
                        mediaElement.addEventListener('click', openMedia);
                        mediaElement.addEventListener('keydown', event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openMedia();
                            }
                        });
                        media.appendChild(mediaElement);
                    }
                });
                postEl.appendChild(media);
            }
            const actions = document.createElement('div');
            actions.className = 'post-actions';
            const actionCapsule = document.createElement('div');
            actionCapsule.className = 'action-bar-capsule';
            const likeButton = document.createElement('button');
            likeButton.className = 'post-action-btn';
            likeButton.type = 'button';
            likeButton.classList.toggle('is-liked', Boolean(post.is_liked));
            likeButton.setAttribute('aria-label', post.is_liked ? 'Unlike post' : 'Like post');
            likeButton.title = post.is_liked ? 'Unlike post' : 'Like post';
            likeButton.appendChild(createIcon('<path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"></path>', 'Like post'));
            const likeCount = document.createElement('span');
            likeCount.textContent = post.likes_count ?? post.likes ?? 0;
            likeButton.append(' ', likeCount);
            likeButton.addEventListener('click', async () => {
                if (likeButton.disabled) return;
                const wasLiked = Boolean(post.is_liked);
                const previousCount = Number(likeCount.textContent) || 0;
                post.is_liked = !wasLiked;
                likeCount.textContent = Math.max(0, previousCount + (wasLiked ? -1 : 1));
                likeButton.classList.toggle('is-liked', post.is_liked);
                likeButton.setAttribute('aria-label', post.is_liked ? 'Unlike post' : 'Like post');
                likeButton.title = post.is_liked ? 'Unlike post' : 'Like post';
                likeButton.disabled = true;
                try {
                    const result = wasLiked
                        ? await this.cancelLikePost(post.id)
                        : await this.likePost(post.id);
                    likeCount.textContent = result.like_count;
                } catch (error) {
                    post.is_liked = wasLiked;
                    likeCount.textContent = previousCount;
                    likeButton.classList.toggle('is-liked', wasLiked);
                    likeButton.setAttribute('aria-label', wasLiked ? 'Unlike post' : 'Like post');
                    likeButton.title = wasLiked ? 'Unlike post' : 'Like post';
                    showNotice(error.message, 'error');
                } finally {
                    likeButton.disabled = false;
                }
            });
            const commentButton = document.createElement('button');
            commentButton.className = 'post-action-btn';
            commentButton.type = 'button';
            commentButton.setAttribute('aria-label', 'Comment on post');
            commentButton.title = 'Comment on post';
            commentButton.appendChild(createIcon('<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.5-.7L4 20l1.7-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"></path>', 'Comment on post'));
            const commentCount = document.createElement('span');
            commentCount.textContent = post.comments_count ?? post.comments ?? 0;
            commentButton.append(' ', commentCount);
            const repostWrap = document.createElement('div');
            repostWrap.className = 'repost-action-wrap';
            const repostButton = document.createElement('button');
            repostButton.className = 'post-action-btn';
            repostButton.type = 'button';
            repostButton.setAttribute('aria-label', 'Repost');
            repostButton.title = 'Repost';
            repostButton.appendChild(createIcon('<path d="m17 2 4 4-4 4"></path><path d="M3 11V9a3 3 0 0 1 3-3h15"></path><path d="m7 22-4-4 4-4"></path><path d="M21 13v2a3 3 0 0 1-3 3H3"></path>', 'Repost'));
            const repostMenu = document.createElement('div');
            repostMenu.className = 'repost-menu glass-card';
            [['Repost', 'Repost this post'], ['Quote Post', 'Add your thoughts']].forEach(([label, description]) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.innerHTML = `<strong>${label}</strong><span>${description}</span>`;
                option.addEventListener('click', async () => {
                    repostMenu.classList.remove('show');
                    try {
                        const quote = label === 'Quote Post' ? window.prompt('Add your thoughts', '') : '';
                        if (label === 'Quote Post' && quote === null) return;
                        await this.repostPost(post.id, label === 'Repost' ? 'repost' : 'quote', quote || '');
                        showNotice(label === 'Repost' ? 'Post reposted.' : 'Quote Post published.', 'success');
                    } catch (error) { showNotice(error.message, 'error'); }
                });
                repostMenu.appendChild(option);
            });
            repostButton.addEventListener('click', event => {
                event.stopPropagation();
                document.querySelectorAll('.repost-menu.show').forEach(menu => menu.classList.remove('show'));
                repostMenu.classList.toggle('show');
            });
            repostWrap.append(repostButton, repostMenu);
            const shareButton = document.createElement('button');
            shareButton.className = 'post-action-btn';
            shareButton.type = 'button';
            shareButton.setAttribute('aria-label', 'Share post');
            shareButton.title = 'Share post';
            shareButton.appendChild(createIcon('<path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path>', 'Share post'));
            shareButton.addEventListener('click', () => openShareModal(post));
            actionCapsule.append(likeButton, commentButton, repostWrap, shareButton);
            actions.appendChild(actionCapsule);
            postEl.appendChild(actions);

            const commentsPanel = document.createElement('section');
            commentsPanel.className = 'comments-panel hidden';
            const commentsList = document.createElement('div');
            commentsList.className = 'comments-list';
            const replyStatus = document.createElement('div');
            replyStatus.className = 'reply-status hidden';
            const replyStatusText = document.createElement('span');
            const cancelReplyButton = document.createElement('button');
            cancelReplyButton.type = 'button';
            cancelReplyButton.className = 'cancel-reply-btn';
            cancelReplyButton.setAttribute('aria-label', 'Cancel reply');
            cancelReplyButton.textContent = 'x';
            replyStatus.append(replyStatusText, cancelReplyButton);
            const composer = document.createElement('form');
            composer.className = 'comment-composer';
            const composerUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
            composer.innerHTML = '<span class="comment-composer-avatar"></span><div class="comment-input-shell"><input type="text" maxlength="1000" placeholder="Write a comment..." aria-label="Comment text"><button type="button" class="comment-media-btn" aria-label="Add image or GIF" title="Add image or GIF">GIF</button></div><button type="submit" class="comment-send-btn" aria-label="Send comment" title="Send comment"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path></svg></button>';
            composer.querySelector('.comment-composer-avatar').replaceWith(createAvatarElement(composerUser.username, getUserAvatarUrl(composerUser), 'comment-composer-avatar'));
            commentsPanel.append(commentsList, replyStatus, composer);
            const composerInput = composer.querySelector('input');
            let selectedGifUrl = '';
            let replyTarget = null;

            const gifPreview = document.createElement('div');
            gifPreview.className = 'comment-gif-preview hidden';
            composer.insertBefore(gifPreview, composer.firstChild);
            setupGifPicker(composer, (gifUrl) => {
                selectedGifUrl = gifUrl;
                gifPreview.innerHTML = `<img src="${gifUrl}" alt="Selected GIF"><button type="button" aria-label="Remove selected GIF">×</button>`;
                gifPreview.classList.remove('hidden');
                gifPreview.querySelector('button').addEventListener('click', () => {
                    selectedGifUrl = '';
                    gifPreview.classList.add('hidden');
                    gifPreview.replaceChildren();
                });
            });

            const clearReplyTarget = () => {
                replyTarget = null;
                replyStatus.classList.add('hidden');
                replyStatusText.textContent = '';
                composerInput.placeholder = 'Write a comment...';
            };

            const setReplyTarget = comment => {
                replyTarget = comment;
                replyStatusText.textContent = `Replying to @${comment.username || 'user'}`;
                replyStatus.classList.remove('hidden');
                composerInput.placeholder = `Reply to ${comment.username || 'user'}...`;
                composerInput.focus();
            };

            cancelReplyButton.addEventListener('click', () => {
                clearReplyTarget();
                composerInput.focus();
            });
            composerInput.addEventListener('input', () => {
                if (!composerInput.value.trim() && replyTarget) clearReplyTarget();
            });
            postEl.appendChild(commentsPanel);

            const renderComment = (comment, depth = 0) => {
                const item = document.createElement('article');
                item.className = depth ? 'comment-item reply-item' : 'comment-item';
                const commentHeader = document.createElement('div');
                commentHeader.className = 'comment-header';
                const avatarWrap = document.createElement('span');
                avatarWrap.className = 'comment-avatar-wrap';
                avatarWrap.appendChild(createAvatarElement(comment.username, comment.avatar_url, 'comment-avatar'));
                const avatarBadge = document.createElement('span');
                avatarBadge.className = 'comment-follow-badge';
                avatarBadge.textContent = '+';
                avatarWrap.appendChild(avatarBadge);
                const meta = document.createElement('strong');
                meta.innerHTML = `@${escapeHtml(comment.username || `user${comment.user_id}`)}${roleBadge(comment.role)}`;
                const time = document.createElement('time');
                time.className = 'comment-relative-time';
                time.dateTime = comment.created_at || '';
                time.textContent = formatRelativeTime(comment.created_at);
                const authorTag = document.createElement('span');
                authorTag.className = 'comment-author-tag author-badge';
                authorTag.dataset.i18n = 'author';
                authorTag.textContent = window.AeroI18n?.translateValue('author') || (localStorage.getItem('aero_language') === 'zh' ? '作者' : 'Author');
                const metaLine = document.createElement('div');
                metaLine.className = 'comment-meta-line';
                metaLine.append(meta, time);
                if (comment.user_id === post.user_id) metaLine.append(authorTag);
                commentHeader.append(avatarWrap, metaLine);
                const body = document.createElement('p');
                body.innerHTML = renderMentionText(comment.content);
                if (comment.image_url) {
                    const gif = document.createElement('img');
                    gif.className = 'comment-gif';
                    gif.src = comment.image_url;
                    gif.alt = 'GIF attached to comment';
                    gif.loading = 'lazy';
                    body.after(gif);
                }
                const commentActions = document.createElement('div');
                commentActions.className = 'comment-actions';
                const likeButton = document.createElement('button');
                likeButton.type = 'button';
                likeButton.className = 'comment-action-btn';
                let commentLiked = Boolean(comment.is_liked);
                let commentLikeCount = Number(comment.likes_count) || 0;
                const updateLike = () => {
                    likeButton.classList.toggle('is-liked', commentLiked);
                    likeButton.innerHTML = `${commentLiked ? '♥' : '♡'} <span>${commentLikeCount}</span>`;
                    likeButton.setAttribute('aria-label', `${commentLiked ? 'Unlike' : 'Like'} comment`);
                };
                updateLike();
                likeButton.addEventListener('click', async () => {
                    likeButton.disabled = true;
                    const previousLiked = commentLiked;
                    commentLiked = !previousLiked;
                    commentLikeCount = Math.max(0, commentLikeCount + (commentLiked ? 1 : -1));
                    updateLike();
                    try {
                        const result = await this.toggleCommentLike(comment.id, previousLiked);
                        commentLiked = result.liked;
                        commentLikeCount = result.like_count;
                        updateLike();
                    } catch (error) {
                        commentLiked = previousLiked;
                        commentLikeCount = Math.max(0, commentLikeCount + (commentLiked ? 1 : -1));
                        updateLike();
                        showNotice(error.message, 'error');
                    } finally { likeButton.disabled = false; }
                });
                const replyButton = document.createElement('button');
                replyButton.type = 'button';
                replyButton.className = 'comment-action-btn comment-reply-btn';
                const replyCount = Array.isArray(comment.replies) ? comment.replies.length : 0;
                replyButton.innerHTML = `↩ <span>Reply${replyCount ? ` ${replyCount}` : ''}</span>`;
                replyButton.addEventListener('click', () => setReplyTarget(comment));
                const repostButton = document.createElement('button');
                repostButton.type = 'button';
                repostButton.className = 'comment-action-btn';
                repostButton.textContent = '↻';
                repostButton.setAttribute('aria-label', 'Repost comment');
                const shareButton = document.createElement('button');
                shareButton.type = 'button';
                shareButton.className = 'comment-action-btn';
                shareButton.textContent = '↗';
                shareButton.setAttribute('aria-label', 'Share comment');
                const effectiveRole = currentUser.is_admin === true ? 'admin' : currentUser.role;
                const canDeleteComment = comment.user_id === currentUser.id || ['admin', 'moderator'].includes(effectiveRole);
                const deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'comment-action-btn comment-delete-btn';
                deleteButton.textContent = 'Delete';
                deleteButton.setAttribute('aria-label', 'Delete comment');
                deleteButton.addEventListener('click', async () => {
                    deleteButton.disabled = true;
                    try {
                        await this.deleteComment(comment.id);
                        item.remove();
                    } catch (error) {
                        deleteButton.disabled = false;
                        showNotice(error.message, 'error');
                    }
                });
                commentActions.append(likeButton, replyButton, repostButton, shareButton);
                if (canDeleteComment) commentActions.appendChild(deleteButton);
                item.append(commentHeader, body, commentActions);
                if (comment.replies && comment.replies.length) {
                    const replies = document.createElement('div');
                    replies.className = 'comment-replies';
                    comment.replies.forEach(reply => replies.appendChild(renderComment(reply, depth + 1)));
                    item.appendChild(replies);
                }
                return item;
            };

            const loadComments = async () => {
                commentsList.innerHTML = `<p class="comments-loading">${window.AeroI18n?.t('loading_comments') || 'Loading comments...'}</p>`;
                try {
                    const comments = await this.getComments(post.id);
                    commentsList.innerHTML = '';
                    if (!comments.length) {
                        commentsList.innerHTML = `<p class="comments-empty">${window.AeroI18n?.t('no_comments') || 'No comments yet.'}</p>`;
                    } else {
                        comments.forEach(comment => commentsList.appendChild(renderComment(comment)));
                    }
                } catch (error) {
                    commentsList.innerHTML = `<p class="comments-empty">${escapeHtml(error.message)}</p>`;
                }
            };

            composer.addEventListener('submit', async event => {
                event.preventDefault();
                const content = composerInput.value.trim();
                if (!content && !selectedGifUrl) return;
                try {
                    await this.sendComment(post.id, content, replyTarget ? replyTarget.id : null, selectedGifUrl);
                    composerInput.value = '';
                    selectedGifUrl = '';
                    gifPreview.classList.add('hidden');
                    gifPreview.replaceChildren();
                    clearReplyTarget();
                    commentCount.textContent = (Number(commentCount.textContent) || 0) + 1;
                    await loadComments();
                } catch (error) {
                    showNotice(error.message, 'error');
                }
            });
            commentButton.addEventListener('click', async () => {
                const isHidden = commentsPanel.classList.toggle('hidden');
                if (!isHidden) await loadComments();
            });
            feedContainer.appendChild(postEl);
        });
        let sentinel = document.getElementById('feed-load-sentinel');
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = 'feed-load-sentinel';
            sentinel.className = 'feed-load-sentinel';
            sentinel.setAttribute('aria-hidden', 'true');
            feedContainer.appendChild(sentinel);
        }
        sentinel.classList.toggle('hidden', !feedHasMore);
        if (feedHasMore && 'IntersectionObserver' in window) {
            feedLoadObserver?.disconnect();
            feedLoadObserver = new IntersectionObserver((entries) => {
                if (entries.some((entry) => entry.isIntersecting)) this.renderFeed(feedTypeState, true);
            }, { rootMargin: '500px 0px' });
            feedLoadObserver.observe(sentinel);
        }
    },

    async initAppState() {
        if (appStateInitialized) return;
        appStateInitialized = true;
        const homeButton = document.getElementById('home-nav-btn');
        const logoButton = document.getElementById('aero-logo');
        const bookmarkDockButton = document.getElementById('bookmark-dock-btn');
        const bookmarkCloseButton = document.getElementById('close-bookmarks-drawer');
        const introPage = document.getElementById('intro-page');
        const authOverlay = document.getElementById('auth-overlay');
        const mainApp = document.getElementById('main-app');

        document.querySelectorAll('[data-open-auth]').forEach((button) => button.addEventListener('click', () => {
            syncLandingState(true);
            introPage?.classList.add('hidden');
            authOverlay?.classList.remove('hidden');
            mainApp?.classList.add('hidden');
        }));
        document.getElementById('explore-guest-btn')?.addEventListener('click', async () => {
            localStorage.setItem('aero_guest_mode', '1');
            syncLandingState(false);
            introPage?.classList.add('hidden');
            authOverlay?.classList.add('hidden');
            mainApp?.classList.remove('hidden');
            renderHeaderNav({});
            await this.renderFeed('for_you');
        });

        bookmarkDockButton?.addEventListener('click', () => {
            if (!requireAuth(null, 'Please sign in before opening bookmarks.')) return;
            const drawer = document.getElementById('bookmarks-drawer');
            const isHidden = drawer?.classList.contains('hidden');
            setBookmarkDrawerVisibility(Boolean(isHidden));
            if (isHidden) {
                loadBookmarksDrawer();
            }
        });
        bookmarkCloseButton?.addEventListener('click', () => setBookmarkDrawerVisibility(false));

        const goHome = async () => {
            if (!window.location.pathname.endsWith('/index.html') && window.location.pathname !== '/') {
                window.location.href = 'index.html';
                return;
            }
            window.AeroRouter?.navigate('main');
            await this.renderFeed();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        homeButton?.addEventListener('click', goHome);
        logoButton?.addEventListener('click', goHome);
        let savedSettings = {};
        try {
            savedSettings = JSON.parse(localStorage.getItem('aero_settings') || '{}');
        } catch (error) {
            savedSettings = {};
        }
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const useDarkMode = savedSettings.theme === 'dark' || (savedSettings.theme === 'system' && prefersDark);
        document.body.classList.toggle('dark-mode', useDarkMode);
        document.body.classList.toggle('light-mode', !useDarkMode);
        document.getElementById('settings-nav-btn')?.addEventListener('click', () => {
            window.location.href = 'settings.html';
        });
        const rightDock = document.querySelector('.dock-right');
        const rightDockScroll = rightDock?.querySelector('.dock-scroll-wrapper');
        const scrollDockTo = (top) => rightDockScroll?.scrollTo({ top, behavior: 'smooth' });
        rightDock?.addEventListener('mousemove', (event) => {
            const bounds = rightDock.getBoundingClientRect();
            scrollDockTo(event.clientY - bounds.top >= bounds.height / 2 ? rightDockScroll.scrollHeight : 0);
        });
        rightDock?.addEventListener('mouseleave', () => scrollDockTo(0));
        const mobileMenuButton = document.getElementById('mobile-menu-btn');
        const mobileDrawer = document.getElementById('mobile-nav-drawer');
        const mobileBackdrop = document.getElementById('mobile-nav-backdrop');
        let mobileMenuCloseTimer = null;
        const closeMobileMenu = () => {
            window.clearTimeout(mobileMenuCloseTimer);
            mobileDrawer?.classList.remove('open');
            mobileBackdrop?.classList.remove('active');
            mobileDrawer?.setAttribute('aria-hidden', 'true');
            mobileMenuButton?.classList.remove('is-open');
            mobileMenuButton?.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            mobileMenuCloseTimer = window.setTimeout(() => {
                if (mobileDrawer?.getAttribute('aria-hidden') !== 'false') {
                    mobileDrawer?.classList.add('hidden');
                    mobileBackdrop?.classList.add('hidden');
                }
            }, 350);
        };
        const openMobileMenu = () => {
            window.clearTimeout(mobileMenuCloseTimer);
            mobileDrawer?.classList.remove('hidden');
            mobileBackdrop?.classList.remove('hidden');
            requestAnimationFrame(() => {
                mobileDrawer?.classList.add('open');
                mobileBackdrop?.classList.add('active');
            });
            mobileDrawer?.setAttribute('aria-hidden', 'false');
            mobileMenuButton?.classList.add('is-open');
            mobileMenuButton?.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
        };
        const desktopViewport = window.matchMedia('(min-width: 769px)');
        const resetMobileMenuForDesktop = (event) => {
            if (event.matches) closeMobileMenu();
        };
        desktopViewport.addEventListener?.('change', resetMobileMenuForDesktop);
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 769) closeMobileMenu();
        }, { passive: true });
        if (desktopViewport.matches) closeMobileMenu();
        mobileMenuButton?.addEventListener('click', () => {
            if (mobileDrawer?.classList.contains('hidden')) openMobileMenu();
            else closeMobileMenu();
        });
        document.getElementById('close-mobile-menu')?.addEventListener('click', closeMobileMenu);
        mobileBackdrop?.addEventListener('click', closeMobileMenu);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !mobileDrawer?.classList.contains('hidden')) closeMobileMenu();
        });
        mobileDrawer?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-mobile-nav]');
            if (!button) return;
            event.preventDefault();
            const target = document.getElementById(button.dataset.mobileNav);
            closeMobileMenu();
            if (target) window.setTimeout(() => target.click(), 0);
        });
        document.querySelectorAll('[data-mobile-action]').forEach((button) => {
            button.addEventListener('click', () => {
                const action = button.dataset.mobileAction;
                if (action === 'home') document.getElementById('home-nav-btn')?.click();
                if (action === 'messages') document.getElementById('chat-dock-btn')?.click();
                if (action === 'profile') document.getElementById('user-avatar-btn')?.click();
                if (action === 'compose') document.getElementById('global-fab-btn')?.click();
                if (action === 'shorts') document.getElementById('video-dock-btn')?.click();
            });
        });
        window.addEventListener('aero:view-change', (event) => {
            const action = event.detail?.view === 'chat' ? 'messages' : event.detail?.view === 'profile' ? 'profile' : event.detail?.view === 'shorts' ? 'shorts' : event.detail?.view === 'main' ? 'home' : '';
            document.querySelectorAll('[data-mobile-action]').forEach((button) => {
                const active = action && button.dataset.mobileAction === action;
                button.classList.toggle('is-active', active);
                if (active) button.setAttribute('aria-current', 'page');
                else button.removeAttribute('aria-current');
            });
        });
        const token = getAuthToken();
        const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
        renderHeaderNav(user);
        
        if (token && mainApp) {
            localStorage.removeItem('aero_guest_mode');
            syncLandingState(false);
            introPage?.classList.add('hidden');
            window.setFabAuthState?.(true);
            if (authOverlay) authOverlay.classList.add('hidden');
            mainApp.classList.remove('hidden');
            document.getElementById('nav-username').innerText = user.username || 'User';
            syncCurrentUserAvatars(user);
            const latestUser = await refreshCurrentUser();
            const initialFeedType = new URLSearchParams(window.location.search).get('tab') === 'following'
                ? 'following'
                : 'for_you';
            if (latestUser) document.getElementById('nav-username').innerText = latestUser.display_name || latestUser.username || 'User';
            await this.renderFeed(initialFeedType);
            if (sessionStorage.getItem('aero_profile_onboarding') === '1') {
                document.getElementById('profile-onboarding-overlay')?.classList.remove('hidden');
            }
        } else if (localStorage.getItem('aero_guest_mode') === '1' && mainApp) {
            syncLandingState(false);
            introPage?.classList.add('hidden');
            authOverlay?.classList.add('hidden');
            mainApp.classList.remove('hidden');
            renderHeaderNav({});
            await this.renderFeed('for_you');
        } else if (authOverlay) {
            window.setFabAuthState?.(false);
            syncLandingState(true);
            introPage?.classList.remove('hidden');
            authOverlay.classList.add('hidden');
            if (mainApp) mainApp.classList.add('hidden');
        }
    },

    transitionToApp() {
        const authOverlay = document.getElementById('auth-overlay');
        const mainApp = document.getElementById('main-app');
        if (!authOverlay || !mainApp) return;

        const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
        syncLandingState(false);
        window.setFabAuthState?.(true);
        renderHeaderNav(user);
        authOverlay.classList.remove('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('app-entering');
        authOverlay.classList.add('is-exiting');
        document.getElementById('nav-username').textContent = user.username || 'User';
        syncCurrentUserAvatars(user);
        this.renderFeed();
        window.setupChatRealtime?.();
        loadChatContacts().catch(() => {});
        loadUnreadChatCount().catch(() => {});

        window.setTimeout(() => {
            authOverlay.classList.add('hidden');
            authOverlay.classList.remove('is-exiting');
            mainApp.classList.remove('app-entering');
        }, 460);
    }
};

window.AeroAPI = AeroAPI;
window.apiService = AeroAPI;
window.addEventListener('aero:language-change', () => {
    const feed = document.getElementById('posts-feed');
    if (feed && localStorage.getItem('aero_token')) AeroAPI.renderFeed().catch(() => {});
    if (activeChatUser && localStorage.getItem('aero_token')) loadChatMessages().catch(() => {});
});
window.toggleFollowUser = async (userId, userMeta = {}) => {
    const api = window.apiService || window.api;
    if (api && typeof api.toggleFollow === 'function') return api.toggleFollow(userId, userMeta);
    const apiOrigin = window.AeroConfig.API_ORIGIN;
    const response = await fetch(`${apiOrigin}/api/users/${userId}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Unable to update follow status');
    return data;
};

function getGlobalPostMenu() {
    let menu = document.getElementById('global-post-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'global-post-menu';
        menu.className = 'post-dropdown-menu post-menu liquid-glass liquid-glass-interactive';
    }
    return menu;
}

function closeAllPostMenus() {
    const globalMenu = document.getElementById('global-post-menu');
    globalMenu?.classList.remove('show', 'active');
    globalMenu?.removeAttribute('data-post-id');
    globalMenu?.remove();
    globalMenu?.style.removeProperty('top');
    globalMenu?.style.removeProperty('left');
    document.querySelectorAll('.post-menu-wrapper.open').forEach(wrapper => wrapper.classList.remove('open'));
    document.querySelectorAll('.post-dropdown-menu, .post-menu').forEach(menu => {
        menu.classList.remove('show', 'active');
        menu.closest('.post-menu-wrapper')?.classList.remove('open');
        menu.closest('.post-card, .post-item')?.classList.remove('menu-open');
    });
    document.querySelectorAll('.post-card.menu-open, .post-item.menu-open').forEach(post => post.classList.remove('menu-open'));
}

async function copyPostLink(postId) {
    const link = `${window.location.origin}${window.location.pathname}#post-${postId}`;
    try {
        await navigator.clipboard.writeText(link);
        await AeroAPI.recordShareStats(postId, 'copy');
        showNotice('Post link copied.', 'success');
    } catch (error) { showNotice('Unable to copy the post link.', 'error'); }
}

function openShareModal(post) {
    let overlay = document.getElementById('share-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'share-modal-overlay';
        overlay.className = 'share-modal-overlay';
        overlay.innerHTML = `<div class="share-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="share-modal-title"><header class="share-modal-header"><div><span class="share-modal-kicker">Aero share</span><h2 id="share-modal-title">Share this post</h2></div><button type="button" class="modal-close-btn share-modal-close" aria-label="Close share dialog">&times;</button></header><p class="share-modal-preview"></p><div class="share-shortcuts"><button type="button" data-share-action="copy"><span class="share-shortcut-icon">⌁</span><strong>Copy Link</strong><small>Copy the post URL</small></button><button type="button" data-share-action="export"><span class="share-shortcut-icon">▧</span><strong>Export as Card</strong><small>Download an image</small></button><button type="button" data-share-action="send"><span class="share-shortcut-icon">➤</span><strong>Send to User</strong><small>Share privately</small></button></div><div class="share-send-form hidden"><label class="share-user-search-label" for="share-user-search">Choose a user</label><input id="share-user-search" type="search" placeholder="Search contacts" aria-label="Search contacts"><div class="share-user-list" role="listbox" aria-label="Users to share with"></div><button type="button" class="btn btn-primary g2-btn" disabled>Send</button></div></div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.classList.remove('is-open');
        overlay.querySelector('.share-modal-close').addEventListener('click', close);
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        overlay.querySelector('[data-share-action="copy"]').addEventListener('click', () => copyPostLink(overlay.dataset.postId));
        overlay.querySelector('[data-share-action="export"]').addEventListener('click', () => {
            exportPostCard(overlay.dataset.postId, overlay.dataset.content, overlay.dataset.username, {
                displayName: overlay.dataset.displayName,
                avatarUrl: overlay.dataset.avatarUrl,
                createdAt: overlay.dataset.createdAt
            });
            AeroAPI.recordShareStats(overlay.dataset.postId, 'share').catch(() => {});
        });
        const sendForm = overlay.querySelector('.share-send-form');
        const userSearch = overlay.querySelector('#share-user-search');
        const userList = overlay.querySelector('.share-user-list');
        const sendButton = sendForm.querySelector('button');
        let shareUsers = [];
        let selectedShareUserId = 0;
        let selectedShareUsername = '';
        const renderShareUsers = () => {
            const query = userSearch.value.trim().toLowerCase();
            const users = shareUsers.filter(user => String(user.username || '').toLowerCase().includes(query));
            userList.innerHTML = users.length ? users.map(user => `<button type="button" class="share-user-option ${selectedShareUserId === Number(user.id) ? 'is-selected' : ''}" data-user-id="${user.id}" data-username="${escapeHtml(user.username)}" role="option" aria-selected="${selectedShareUserId === Number(user.id)}"><span class="share-user-avatar">${user.avatar_url ? `<img src="${escapeHtml(user.avatar_url)}" alt="">` : escapeHtml((user.username || 'U').charAt(0).toUpperCase())}</span><span class="share-user-name">@${escapeHtml(user.username)}</span><span class="share-user-check" aria-hidden="true">✓</span></button>`).join('') : '<div class="share-user-empty">No contacts found.</div>';
            sendButton.disabled = !selectedShareUserId;
            userList.querySelectorAll('.share-user-option').forEach(option => option.addEventListener('click', () => {
                selectedShareUserId = Number(option.dataset.userId) || 0;
                selectedShareUsername = option.dataset.username || '';
                renderShareUsers();
            }));
        };
        const loadShareUsers = async () => {
            userList.innerHTML = '<div class="share-user-empty">Loading contacts...</div>';
            try {
                const response = await fetch(`${API_BASE}/chat/contacts`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
                const users = await response.json().catch(() => []);
                if (!response.ok) throw new Error('Unable to load contacts');
                shareUsers = Array.isArray(users) ? users : [];
                renderShareUsers();
            } catch (error) {
                userList.innerHTML = `<div class="share-user-empty">${escapeHtml(error.message)}</div>`;
                sendButton.disabled = true;
            }
        };
        overlay.querySelector('[data-share-action="send"]').addEventListener('click', () => {
            const opening = sendForm.classList.contains('hidden');
            sendForm.classList.toggle('hidden', !opening);
            if (opening) {
                selectedShareUserId = 0;
                selectedShareUsername = '';
                userSearch.value = '';
                sendButton.disabled = true;
                loadShareUsers();
            }
        });
        let searchRenderFrame = 0;
        userSearch.addEventListener('input', () => {
            cancelAnimationFrame(searchRenderFrame);
            searchRenderFrame = requestAnimationFrame(renderShareUsers);
        });
        sendButton.addEventListener('click', () => {
            const recipient = selectedShareUsername;
            if (selectedShareUserId) {
                sendButton.disabled = true;
                AeroAPI.sendPostToUser(overlay.dataset.postId, selectedShareUserId, recipient)
                    .then(() => { close(); showNotice(`Post shared with @${recipient}.`, 'success'); })
                    .catch(error => { sendButton.disabled = false; showNotice(error.message, 'error'); });
            }
        });
    }
    if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
    overlay.dataset.postId = String(post.id);
    overlay.dataset.content = post.content || '';
    overlay.dataset.username = post.username || 'User';
    overlay.dataset.displayName = post.display_name || post.name || post.username || 'User';
    overlay.dataset.avatarUrl = post.avatar_url || post.author_avatar || '';
    overlay.dataset.createdAt = post.created_at || '';
    overlay.querySelector('.share-modal-preview').textContent = `${post.username || 'User'}: ${post.content || 'Aero post'}`;
    overlay.classList.add('is-open');
}

function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-html2canvas]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.html2canvas));
            existing.addEventListener('error', () => reject(new Error('Unable to load card renderer')));
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        script.async = true;
        script.dataset.html2canvas = 'true';
        script.addEventListener('load', () => resolve(window.html2canvas));
        script.addEventListener('error', () => reject(new Error('Unable to load card renderer')));
        document.head.appendChild(script);
    });
}

function exportPostCard(postId, content, username, details = {}) {
    const escape = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const normalizedAvatar = String(details.avatarUrl || '');
    const avatarUrl = normalizedAvatar && !normalizedAvatar.startsWith('letter:')
        ? (normalizedAvatar.startsWith('http') ? normalizedAvatar : `${API_ORIGIN}${normalizedAvatar}`)
        : '';
    const displayName = details.displayName || username || 'User';
    const handle = `@${username || 'user'}`;
    const createdAt = details.createdAt ? new Date(details.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Aero post';
    const postUrl = `${window.location.origin}${window.location.pathname}#post-${encodeURIComponent(postId)}`;
    const avatarMarkup = avatarUrl
        ? `<img src="${escape(avatarUrl)}" crossorigin="anonymous" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover;">`
        : `<div style="width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#0a84ff,#00c6ff);color:#fff;font-size:22px;font-weight:800;">${escape((displayName || 'U').charAt(0).toUpperCase())}</div>`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=96x96&margin=0&data=${encodeURIComponent(postUrl)}`;
    const postContentHtml = escape(content || 'Aero post').replace(/\r?\n/g, '<br>');
    const template = document.createElement('div');
    template.id = 'export-card-template';
    template.setAttribute('aria-hidden', 'true');
    template.style.cssText = 'position:fixed;left:-10000px;top:0;width:500px;height:625px;padding:30px;box-sizing:border-box;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at 10% 5%,rgba(255,255,255,.78),transparent 34%),radial-gradient(circle at 90% 85%,rgba(0,198,255,.32),transparent 38%),linear-gradient(135deg,#9fc9ff 0%,#d4f0ff 45%,#f5d8ef 100%);color:#1c1c1e;';
    template.innerHTML = `<div class="export-inner-card" style="height:100%;padding:28px;border:1px solid rgba(255,255,255,.72);border-radius:30px;background:rgba(255,255,255,.68);box-shadow:0 24px 50px rgba(25,50,80,.16),inset 0 1px 1px rgba(255,255,255,.9);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;flex-direction:column;box-sizing:border-box;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:24px;">
            <div style="display:flex;align-items:center;gap:12px;min-width:0;">${avatarMarkup}<div style="min-width:0;"><div style="font-weight:800;font-size:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escape(displayName)}</div><div style="margin-top:3px;color:#667085;font-size:14px;">${escape(handle)}</div></div></div>
            <div style="flex:0 0 auto;color:#667085;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Aero Post</div>
        </div>
        <div style="flex:1;overflow:hidden;font-size:21px;line-height:1.52;font-weight:500;word-break:break-word;color:#26313d;">${postContentHtml}</div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:22px;padding-top:16px;border-top:1px solid rgba(22,32,45,.1);">
            <div style="min-width:0;"><div style="font-size:11px;color:#667085;margin-bottom:9px;">${escape(createdAt)}</div><div style="display:flex;align-items:center;gap:7px;"><strong style="font-size:21px;letter-spacing:-.04em;color:#087cff;">Aero</strong><span style="font-size:12px;color:#667085;">Share via Aero</span></div></div>
            <div style="padding:5px;border-radius:12px;background:#fff;box-shadow:0 5px 14px rgba(20,40,60,.1);"><img crossorigin="anonymous" src="${escape(qrUrl)}" alt="" style="display:block;width:64px;height:64px;"></div>
        </div>
    </div>`;
    document.body.appendChild(template);
    return loadHtml2Canvas().then((render) => {
        if (typeof render !== 'function') throw new Error('Card renderer is unavailable');
        return Promise.all(Array.from(template.querySelectorAll('img')).map((image) => image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            }))).then(() => render(template, { backgroundColor: null, scale: 2, pixelRatio: 2, useCORS: true, allowTaint: false, logging: false }));
    }).then((canvas) => {
        const link = document.createElement('a');
        link.download = `aero-post-${postId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showNotice('Card image downloaded.', 'success');
    }).catch((error) => {
        console.error('Post card export failed:', error);
        showNotice('Unable to export the card image.', 'error');
    }).finally(() => template.remove());
}



const threadsPostState = [{ content: '', files: [], gif: '' }];
let threadsActivePostIndex = 0;
const mentionPickerState = { menu: null, timer: null, requestId: 0, items: [], activeIndex: -1, match: null };

function mentionAtCaret(input) {
    if (input.selectionStart !== input.selectionEnd) return null;
    const prefix = input.value.slice(0, input.selectionStart);
    const match = prefix.match(/(^|[\s([{])([@#])([\p{L}\p{N}_.-]*)$/u);
    if (!match) return null;
    const kind = match[2] === '@' ? 'mention' : 'hashtag';
    if (kind === 'mention' && !/^[A-Za-z0-9_.-]*$/.test(match[3])) return null;
    return { start: input.selectionStart - match[0].length + match[1].length, end: input.selectionStart, query: match[3], kind };
}

function positionMentionMenu(input) {
    const rect = input.getBoundingClientRect();
    const mirror = document.createElement('div');
    const style = getComputedStyle(input);
    ['font', 'padding', 'border', 'boxSizing', 'lineHeight', 'letterSpacing', 'textIndent', 'textTransform'].forEach((key) => { mirror.style[key] = style[key]; });
    Object.assign(mirror.style, {
        position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`,
        visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', overflow: 'hidden'
    });
    mirror.textContent = input.value.slice(0, input.selectionStart);
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);
    mirror.scrollTop = input.scrollTop;
    const markerRect = marker.getBoundingClientRect();
    mirror.remove();
    const menu = mentionPickerState.menu;
    if (!menu) return;
    const top = Math.min(markerRect.bottom + 6, window.innerHeight - 280);
    menu.style.left = `${Math.max(8, Math.min(markerRect.left, window.innerWidth - 296))}px`;
    menu.style.top = `${Math.max(8, top)}px`;
}

function closeMentionMenu() {
    mentionPickerState.requestId += 1;
    window.clearTimeout(mentionPickerState.timer);
    mentionPickerState.match = null;
    mentionPickerState.items = [];
    mentionPickerState.activeIndex = -1;
    mentionPickerState.menu?.classList.add('hidden');
}

function showMentionMenuMessage(message, input) {
    const menu = mentionPickerState.menu;
    if (!menu) return;
    const status = document.createElement('div');
    status.className = 'mention-empty-state';
    status.setAttribute('role', 'status');
    status.textContent = message;
    const children = [];
    if (mentionPickerState.match?.kind === 'hashtag' && !mentionPickerState.match.query) {
        const header = document.createElement('div');
        header.className = 'mention-section-header';
        header.textContent = '热门标签';
        children.push(header);
    }
    children.push(status);
    menu.replaceChildren(...children);
    menu.classList.remove('hidden');
    positionMentionMenu(input);
}

function selectMention(item) {
    const input = document.querySelector('#threads-compose-editor .threads-textarea');
    const match = mentionPickerState.match;
    if (!input || !match || !item) return;
    const insertion = match.kind === 'mention' ? `@${item.user.username} ` : `#${item.tag} `;
    input.value = `${input.value.slice(0, match.start)}${insertion}${input.value.slice(match.end)}`;
    const cursor = match.start + insertion.length;
    input.focus();
    input.setSelectionRange(cursor, cursor);
    closeMentionMenu();
    updateThreadsComposerState();
}

function renderMentionMenu(payload, input, currentMatch) {
    const menu = mentionPickerState.menu;
    if (!menu) return;
    if (currentMatch.kind === 'hashtag') {
        const tags = Array.isArray(payload.hashtags) ? payload.hashtags : [];
        const exact = tags.some(item => item.tag.toLowerCase() === currentMatch.query.toLowerCase());
        mentionPickerState.items = [
            ...(currentMatch.query && !exact ? [{ tag: currentMatch.query, create: true }] : []),
            ...tags.map(item => ({ tag: item.tag, postCount: item.post_count, create: false }))
        ];
        mentionPickerState.activeIndex = mentionPickerState.items.length ? 0 : -1;
        menu.replaceChildren();
        if (!currentMatch.query) {
            const header = document.createElement('div');
            header.className = 'mention-section-header';
            header.textContent = '热门标签';
            menu.appendChild(header);
        }
        mentionPickerState.items.forEach((item, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `mention-user-item${index === mentionPickerState.activeIndex ? ' is-active' : ''}`;
            button.dataset.mentionIndex = String(index);
            button.setAttribute('role', 'option');
            button.setAttribute('aria-selected', String(index === mentionPickerState.activeIndex));
            const label = document.createElement('strong');
            label.textContent = item.create ? `创建标签 #${item.tag}` : `#${item.tag}`;
            button.appendChild(label);
            if (!item.create) {
                const count = document.createElement('small');
                count.className = 'mention-following-badge';
                count.textContent = `${item.postCount || 0} 帖子`;
                button.appendChild(count);
            }
            button.addEventListener('mousedown', event => event.preventDefault());
            button.addEventListener('click', () => selectMention(item));
            menu.appendChild(button);
        });
        if (mentionPickerState.items.length) {
            menu.classList.remove('hidden');
            positionMentionMenu(input);
        } else showMentionMenuMessage('暂无热门标签', input);
        return;
    }
    const groups = [
        { label: 'Following', users: payload.friends || [] },
        { label: 'Other people', users: payload.others || [] }
    ];
    mentionPickerState.items = groups.flatMap(group => group.users.map(user => ({ user, isFollowing: group.label === 'Following' })));
    mentionPickerState.activeIndex = mentionPickerState.items.length ? 0 : -1;
    menu.replaceChildren();
    groups.forEach((group) => {
        if (!group.users.length) return;
        const header = document.createElement('div');
        header.className = 'mention-section-header';
        header.textContent = group.label;
        menu.appendChild(header);
        group.users.forEach((user) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mention-user-item';
            button.dataset.mentionIndex = String(mentionPickerState.items.findIndex(item => item.user.id === user.id));
            button.innerHTML = `${user.avatar_url ? `<img src="${escapeHtml(user.avatar_url)}" alt="">` : '<span class="mention-avatar-fallback" aria-hidden="true"></span>'}<span class="mention-user-copy"><strong>@${escapeHtml(user.username)}</strong><small>${escapeHtml(user.display_name || user.username)}</small></span>${group.label === 'Following' ? '<span class="mention-following-badge">Following</span>' : ''}`;
            button.addEventListener('mousedown', event => event.preventDefault());
            button.addEventListener('click', () => selectMention({ user }));
            menu.appendChild(button);
        });
    });
    if (mentionPickerState.items.length) {
        menu.classList.remove('hidden');
        positionMentionMenu(input);
    } else {
        showMentionMenuMessage(currentMatch.query ? '没有匹配的用户' : '暂无关注用户', input);
    }
}

function updateMentionPicker(input) {
    const match = mentionAtCaret(input);
    if (!match) {
        closeMentionMenu();
        return;
    }
    mentionPickerState.match = match;
    showMentionMenuMessage(match.kind === 'hashtag' ? '正在寻找标签...' : '正在寻找用户...', input);
    const currentMatch = match;
    window.clearTimeout(mentionPickerState.timer);
    const requestId = ++mentionPickerState.requestId;
    mentionPickerState.timer = window.setTimeout(async () => {
        try {
            const endpoint = currentMatch.kind === 'mention' ? 'users/search-mention' : 'hashtags/search';
            const response = await fetch(`${API_BASE}/${endpoint}?q=${encodeURIComponent(currentMatch.query)}`, { headers: authHeaders({ Accept: 'application/json' }) });
            if (requestId !== mentionPickerState.requestId) return;
            if (!response.ok) throw new Error(`Mention search returned ${response.status}`);
            renderMentionMenu(await response.json(), input, currentMatch);
        } catch (error) {
            if (requestId === mentionPickerState.requestId) showMentionMenuMessage(currentMatch.kind === 'mention' ? '暂时无法加载用户' : '暂时无法加载标签', input);
        }
    }, 80);
}

function onMentionKeydown(event) {
    const menu = mentionPickerState.menu;
    if (!menu || menu.classList.contains('hidden')) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!mentionPickerState.items.length) { event.preventDefault(); return; }
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        mentionPickerState.activeIndex = (mentionPickerState.activeIndex + direction + mentionPickerState.items.length) % mentionPickerState.items.length;
        menu.querySelectorAll('.mention-user-item').forEach((item, index) => {
            const selected = Number(item.dataset.mentionIndex) === mentionPickerState.activeIndex;
            item.classList.toggle('is-active', selected);
            item.setAttribute('aria-selected', String(selected));
        });
        menu.querySelector('.mention-user-item.is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && mentionPickerState.activeIndex >= 0) {
        event.preventDefault();
        selectMention(mentionPickerState.items[mentionPickerState.activeIndex]);
    } else if (event.key === 'Escape') {
        closeMentionMenu();
    }
}

function updateThreadsComposerState() {
    const editor = document.getElementById('threads-compose-editor');
    const submitButton = document.getElementById('threads-submit-btn');
    if (!editor || !submitButton) return;
    const textareas = Array.from(editor.querySelectorAll('.threads-textarea'));
    textareas.forEach((textarea, index) => {
        if (threadsPostState[index]) threadsPostState[index].content = textarea.value;
    });
    submitButton.disabled = !threadsPostState.some((post) => post.content.trim() || post.files.length || post.gif);
}

function updateThreadsUser() {
    const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
    const username = user.display_name || user.username || 'User';
    const avatarUrl = window.getUserAvatarUrl?.(user) || user.avatar_url || '';
    document.querySelectorAll('#threads-compose-overlay .current-user-name').forEach((node) => { node.textContent = username; });
    document.querySelectorAll('#threads-compose-overlay .current-user-avatar').forEach((avatar) => {
        if (avatarUrl) {
            avatar.src = avatarUrl;
            avatar.classList.remove('is-empty');
        } else {
            avatar.removeAttribute('src');
            avatar.classList.add('is-empty');
            avatar.dataset.initial = username.charAt(0).toUpperCase();
        }
    });
}

function openThreadsCompose(event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (window.requireAuth && !window.requireAuth(null, 'Please sign in before creating a post.')) return;
    const overlay = document.getElementById('threads-compose-overlay');
    if (!overlay) return;
    updateThreadsUser();
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('threads-compose-open');
    window.setTimeout(() => overlay.querySelector('.threads-textarea')?.focus(), 0);
}

function closeThreadsCompose(saveDraft = true) {
    const overlay = document.getElementById('threads-compose-overlay');
    if (!overlay) return;
    updateThreadsComposerState();
    if (saveDraft && threadsPostState.some((post) => post.content.trim() || post.files.length || post.gif)) {
        let drafts = [];
        try { drafts = JSON.parse(localStorage.getItem('aero_post_drafts') || '[]'); } catch {}
        drafts.unshift({ id: Date.now(), content: threadsPostState.map((post) => post.content).join('\n---\n'), updatedAt: new Date().toISOString() });
        localStorage.setItem('aero_post_drafts', JSON.stringify(drafts.slice(0, 30)));
    }
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('threads-compose-open');
    document.getElementById('threads-drafts-view')?.classList.add('hidden');
    document.getElementById('threads-compose-editor')?.classList.remove('hidden');
    document.getElementById('threads-modal-title').textContent = 'New Post';
    document.getElementById('threads-more-menu')?.classList.add('hidden');
    document.getElementById('threads-topic-menu')?.classList.add('hidden');
    document.getElementById('threads-options-menu')?.classList.add('hidden');
    document.getElementById('threads-schedule-field')?.classList.add('hidden');
    document.getElementById('threads-gif-picker')?.classList.add('hidden');
    document.getElementById('threads-emoji-picker')?.classList.add('hidden');
    closeThreadsPanels();
    threadsPostState.splice(0, threadsPostState.length, { content: '', files: [], gif: '' });
    threadsActivePostIndex = 0;
    const root = document.querySelector('#threads-compose-editor .threads-post-item[data-index="0"]');
    if (root) {
        const textarea = root.querySelector('.threads-textarea');
        if (textarea) textarea.value = '';
        root.querySelector('.threads-media-list')?.replaceChildren();
        root.querySelector('.threads-thread-line')?.classList.add('hidden');
    }
    document.querySelectorAll('#threads-compose-editor .threads-post-item:not([data-index="0"])').forEach((item) => item.remove());
    const submitButton = document.getElementById('threads-submit-btn');
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Post'; }
    document.getElementById('threads-compose-error')?.classList.add('hidden');
}

function closeThreadsPanels(exceptId = '') {
    ['threads-more-menu', 'threads-topic-menu', 'threads-emoji-picker', 'threads-options-menu', 'threads-schedule-field', 'threads-gif-picker'].forEach((id) => {
        if (id !== exceptId) document.getElementById(id)?.classList.add('hidden');
    });
    if (exceptId !== 'threads-more-menu') document.getElementById('threads-more-btn')?.setAttribute('aria-expanded', 'false');
    if (exceptId !== 'threads-topic-menu') document.getElementById('threads-topic-select')?.setAttribute('aria-expanded', 'false');
    if (exceptId !== 'threads-options-menu') document.getElementById('threads-options-btn')?.setAttribute('aria-expanded', 'false');
    if (exceptId !== 'threads-emoji-picker') document.querySelector('#threads-compose-overlay [data-threads-action="emoji"]')?.setAttribute('aria-expanded', 'false');
}

function renderThreadChildren() {
    const editor = document.getElementById('threads-compose-editor');
    const root = editor?.querySelector('.threads-post-item[data-index="0"]');
    if (!editor || !root) return;
    root.querySelector('.threads-thread-line')?.classList.toggle('hidden', threadsPostState.length < 2);
    editor.querySelectorAll('.threads-post-item:not([data-index="0"])').forEach((item) => item.remove());
    const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
    const username = user.display_name || user.username || 'User';
    const avatarUrl = window.getUserAvatarUrl?.(user) || user.avatar_url || '';
    for (let index = 1; index < threadsPostState.length; index += 1) {
        const item = document.createElement('div');
        item.className = 'threads-post-item threads-child-post';
        item.dataset.index = String(index);
        item.innerHTML = `<div class="threads-post-rail"><img class="threads-avatar ${avatarUrl ? '' : 'is-empty'}" alt=""><span class="threads-thread-line"></span></div><div class="threads-post-content"><div class="threads-reply-byline"><span class="threads-username"></span><span class="threads-post-counter"></span><button type="button" class="threads-remove-child" data-remove-thread="${index}" aria-label="Remove thread post">×</button></div><textarea class="threads-textarea" placeholder="Continue this thread..." rows="3" maxlength="5000" aria-label="Thread post ${index + 1}"></textarea><div class="threads-media-list"></div></div>`;
        const avatar = item.querySelector('.threads-avatar');
        if (avatarUrl) avatar.src = avatarUrl;
        else avatar.dataset.initial = username.charAt(0).toUpperCase();
        item.querySelector('.threads-username').textContent = username;
        item.querySelector('.threads-post-counter').textContent = `${index + 1}/${threadsPostState.length}`;
        item.querySelector('.threads-textarea').value = threadsPostState[index].content;
        editor.appendChild(item);
    }
    editor.querySelectorAll('.threads-post-item').forEach((item, index) => {
        item.querySelector('.threads-thread-line')?.classList.toggle('hidden', index >= threadsPostState.length - 1);
        const counter = item.querySelector('.threads-post-counter');
        if (counter) counter.textContent = `${index + 1}/${threadsPostState.length}`;
    });
}

function renderThreadMediaList(index) {
    const item = document.querySelector(`#threads-compose-editor .threads-post-item[data-index="${index}"]`);
    const list = item?.querySelector('.threads-media-list');
    if (!list) return;
    list.replaceChildren();
    const media = [...threadsPostState[index].files, ...(threadsPostState[index].gif ? [{ name: 'GIF', isGif: true }] : [])];
    media.forEach((file, fileIndex) => {
        const chip = document.createElement('span');
        chip.className = 'threads-media-chip';
        chip.append(document.createTextNode(file.name));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Remove ${file.name}`);
        remove.addEventListener('click', () => {
            if (file.isGif) threadsPostState[index].gif = '';
            else threadsPostState[index].files.splice(fileIndex, 1);
            renderThreadMediaList(index);
            updateThreadsComposerState();
        });
        chip.appendChild(remove);
        list.appendChild(chip);
    });
}

function renderThreadsDrafts() {
    const view = document.getElementById('threads-drafts-view');
    if (!view) return;
    let drafts = [];
    try { drafts = JSON.parse(localStorage.getItem('aero_post_drafts') || '[]'); } catch {}
    view.replaceChildren();
    if (!drafts.length) {
        const empty = document.createElement('p');
        empty.className = 'threads-drafts-empty';
        empty.textContent = 'No drafts yet';
        view.appendChild(empty);
    } else drafts.forEach((draft, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'threads-draft-item';
        button.textContent = draft.content || `Draft ${index + 1}`;
        button.addEventListener('click', () => {
            const content = String(draft.content || '').split('\n---\n');
            threadsPostState.splice(0, threadsPostState.length, ...content.map((text) => ({ content: text, files: [], gif: '' })));
            document.querySelector('#threads-compose-editor .threads-textarea').value = content[0] || '';
            renderThreadChildren();
            view.classList.add('hidden');
            document.getElementById('threads-compose-editor').classList.remove('hidden');
            document.getElementById('threads-modal-title').textContent = 'New Post';
            updateThreadsComposerState();
        });
        view.appendChild(button);
    });
}

async function publishThreadsPosts() {
    updateThreadsComposerState();
    const entries = threadsPostState.filter((post) => post.content.trim() || post.files.length || post.gif);
    if (!entries.length) return;
    const button = document.getElementById('threads-submit-btn');
    const error = document.getElementById('threads-compose-error');
    button.disabled = true;
    error.classList.add('hidden');
    try {
        const posts = await Promise.all(entries.map(async (post) => ({
            content: post.content.trim(),
            images: [...await Promise.all(post.files.map((file) => AeroAPI.uploadMedia(file))), ...(post.gif ? [post.gif] : [])],
        })));
        const response = await fetch(`${API_BASE}/posts/chain`, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                posts,
                reply_permission: document.getElementById('threads-reply-permission').value,
                review_replies: document.getElementById('threads-review-replies').checked,
                share_to: document.getElementById('threads-share-to').value,
                scheduled_at: document.getElementById('threads-scheduled-at').value || null,
                topic: document.querySelector('.selected-topic')?.textContent || '',
            }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Unable to publish thread');
        closeThreadsCompose(false);
        await AeroAPI.renderFeed();
    } catch (publishError) {
        error.textContent = publishError.message || 'Unable to publish thread';
        error.classList.remove('hidden');
    } finally {
        button.disabled = false;
    }
}

function openCreatePostModal(event) {
    openThreadsCompose(event);
}

function setupCreatePostExperience() {
    const overlay = document.getElementById('threads-compose-overlay');
    if (!overlay) return;
    if (!mentionPickerState.menu) {
        mentionPickerState.menu = document.createElement('div');
        mentionPickerState.menu.className = 'mention-dropdown-menu hidden';
        mentionPickerState.menu.setAttribute('role', 'listbox');
        document.body.appendChild(mentionPickerState.menu);
    }
    const input = overlay.querySelector('.threads-textarea');
    if (input) {
        input.addEventListener('input', updateThreadsComposerState);
        input.addEventListener('input', () => updateMentionPicker(input));
        input.addEventListener('click', () => updateMentionPicker(input));
        input.addEventListener('keyup', (event) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) updateMentionPicker(input); });
        input.addEventListener('keydown', onMentionKeydown);
    }
    document.querySelectorAll('#global-fab-btn, #compose-trigger, .compose-trigger-media, [data-mobile-action="compose"], .btn-new-post, #new-post-btn, .share-box-input, [data-action="create-post"]').forEach((button) => {
        button.addEventListener('click', openCreatePostModal);
    });
    document.getElementById('compose-trigger')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') openCreatePostModal(event);
    });
    document.getElementById('threads-cancel-btn')?.addEventListener('click', () => closeThreadsCompose(true));
    overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) closeThreadsCompose(true); });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !overlay.classList.contains('hidden')) closeThreadsCompose(true);
    });
    document.getElementById('threads-add-chain-btn')?.addEventListener('click', () => {
        closeThreadsPanels();
        updateThreadsComposerState();
        if (threadsPostState.length >= 10) return;
        threadsPostState.push({ content: '', files: [], gif: '' });
        renderThreadChildren();
        overlay.querySelector('.threads-post-item:last-child .threads-textarea')?.focus();
        updateThreadsComposerState();
    });
    document.getElementById('threads-media-input')?.addEventListener('change', (event) => {
        const files = Array.from(event.target.files || []);
        threadsPostState[threadsActivePostIndex].files.push(...files);
        event.target.value = '';
        renderThreadMediaList(threadsActivePostIndex);
        updateThreadsComposerState();
    });
    overlay.addEventListener('focusin', (event) => {
        const item = event.target.closest('.threads-post-item');
        if (item) threadsActivePostIndex = Number(item.dataset.index) || 0;
    });
    overlay.addEventListener('input', (event) => {
        if (event.target.matches('.threads-textarea')) updateThreadsComposerState();
    });
    overlay.addEventListener('click', (event) => {
        const removeIndex = event.target.closest('[data-remove-thread]')?.dataset.removeThread;
        if (removeIndex !== undefined) {
            updateThreadsComposerState();
            threadsPostState.splice(Number(removeIndex), 1);
            renderThreadChildren();
            updateThreadsComposerState();
            return;
        }
        const action = event.target.closest('[data-threads-action]')?.dataset.threadsAction;
        if (action === 'media') { closeThreadsPanels(); document.getElementById('threads-media-input')?.click(); }
        if (action === 'emoji') {
            const picker = document.getElementById('threads-emoji-picker');
            const button = overlay.querySelector('[data-threads-action="emoji"]');
            const opening = picker.classList.contains('hidden');
            closeThreadsPanels(opening ? 'threads-emoji-picker' : '');
            picker.classList.toggle('hidden', !opening);
            button.setAttribute('aria-expanded', String(opening));
        }
        const selectedEmoji = event.target.closest('[data-emoji]')?.dataset.emoji;
        if (selectedEmoji) {
            const textarea = overlay.querySelector(`.threads-post-item[data-index="${threadsActivePostIndex}"] .threads-textarea`);
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const insertion = `${selectedEmoji} `;
                textarea.value = `${textarea.value.slice(0, start)}${insertion}${textarea.value.slice(end)}`;
                textarea.focus();
                textarea.setSelectionRange(start + insertion.length, start + insertion.length);
                updateThreadsComposerState();
            }
            closeThreadsPanels();
        }
        if (action === 'poll' || action === 'quote') {
            closeThreadsPanels();
            const textarea = overlay.querySelector(`.threads-post-item[data-index="${threadsActivePostIndex}"] .threads-textarea`);
            if (textarea) { textarea.value += action === 'poll' ? `${textarea.value ? '\n' : ''}Poll: ` : '“”'; updateThreadsComposerState(); textarea.focus(); }
        }
        if (action === 'location') {
            closeThreadsPanels();
            if (navigator.geolocation) navigator.geolocation.getCurrentPosition(({ coords }) => {
                const textarea = overlay.querySelector(`.threads-post-item[data-index="${threadsActivePostIndex}"] .threads-textarea`);
                if (textarea) { textarea.value += ` 📍${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`; updateThreadsComposerState(); }
            });
        }
        if (action === 'gif') {
            const picker = document.getElementById('threads-gif-picker');
            const opening = picker.classList.contains('hidden');
            closeThreadsPanels(opening ? 'threads-gif-picker' : '');
            picker.replaceChildren(...trendingGifs.map((gif) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'threads-gif-choice';
                button.innerHTML = `<img src="${escapeHtml(gif.url)}" alt="${escapeHtml(gif.name)}">`;
                button.addEventListener('click', () => {
                    threadsPostState[threadsActivePostIndex].gif = gif.url;
                    renderThreadMediaList(threadsActivePostIndex);
                    closeThreadsPanels();
                    updateThreadsComposerState();
                });
                return button;
            }));
            picker.classList.toggle('hidden', !opening);
        }
        if (action === 'suggest-tag') {
            closeThreadsPanels();
            const textarea = overlay.querySelector('.threads-textarea');
            if (textarea) { textarea.value += `${textarea.value ? ' ' : ''}#Aero`; updateThreadsComposerState(); }
        }
        if (action === 'schedule') {
            const field = document.getElementById('threads-schedule-field');
            const opening = field.classList.contains('hidden');
            closeThreadsPanels(opening ? 'threads-schedule-field' : '');
            field.classList.toggle('hidden', !opening);
        }
        if (event.target.closest('#threads-more-btn')) {
            const panel = document.getElementById('threads-more-menu');
            const opening = panel.classList.contains('hidden');
            closeThreadsPanels(opening ? 'threads-more-menu' : '');
            panel.classList.toggle('hidden', !opening);
            event.target.closest('#threads-more-btn').setAttribute('aria-expanded', String(opening));
        }
        if (event.target.closest('#threads-topic-select')) {
            const panel = document.getElementById('threads-topic-menu');
            const opening = panel.classList.contains('hidden');
            closeThreadsPanels(opening ? 'threads-topic-menu' : '');
            panel.classList.toggle('hidden', !opening);
            event.target.closest('#threads-topic-select').setAttribute('aria-expanded', String(opening));
        }
        const topic = event.target.closest('[data-topic]');
        if (topic) {
            document.querySelector('.selected-topic').textContent = topic.textContent;
            closeThreadsPanels();
        }
        if (event.target.closest('#threads-options-btn')) {
            const panel = document.getElementById('threads-options-menu');
            const opening = panel.classList.contains('hidden');
            closeThreadsPanels(opening ? 'threads-options-menu' : '');
            panel.classList.toggle('hidden', !opening);
            event.target.closest('#threads-options-btn').setAttribute('aria-expanded', String(opening));
        }
        if (event.target.closest('#threads-drafts-btn')) {
            closeThreadsPanels();
            const editor = document.getElementById('threads-compose-editor');
            const draftsView = document.getElementById('threads-drafts-view');
            const opening = draftsView.classList.contains('hidden');
            if (opening) renderThreadsDrafts();
            draftsView.classList.toggle('hidden', !opening);
            editor.classList.toggle('hidden', opening);
            document.getElementById('threads-modal-title').textContent = opening ? 'Drafts' : 'New Post';
        }
        if (event.target.closest('#threads-submit-btn')) publishThreadsPosts();
        if (!event.target.closest('.threads-menu-anchor, .threads-inline-options, #threads-options-btn, [data-threads-action="gif"]')) closeThreadsPanels();
    });
}

function setupPostScrollBehavior() {
    const fab = document.getElementById('global-fab-btn');
    let lastScroll = window.scrollY;
    let idleTimer;
    window.addEventListener('scroll', () => {
        const current = window.scrollY;
        fab?.classList.toggle('is-compact', current > lastScroll && current > 32);
        lastScroll = current;
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => fab?.classList.remove('is-compact'), 180);
    }, { passive: true });
}

function prepareImages(root = document) {
    if (root.matches?.('img')) {
        root.decoding = 'async';
        if (!root.loading && root.getBoundingClientRect().top > window.innerHeight) root.loading = 'lazy';
    }
    root.querySelectorAll?.('img').forEach((image) => {
        image.decoding = 'async';
        if (!image.loading && image.getBoundingClientRect().top > window.innerHeight) image.loading = 'lazy';
    });
}

function setupPageVisibilitySaver() {
    const setHiddenState = (isHidden) => {
        document.documentElement.classList.toggle('page-hidden', isHidden);
        document.querySelectorAll('video, audio').forEach((media) => {
            if (isHidden) {
                media.dataset.wasPlaying = media.paused ? 'false' : 'true';
                media.pause();
            } else if (media.dataset.wasPlaying === 'true') {
                media.play().catch(() => {});
                delete media.dataset.wasPlaying;
            }
        });
    };
    document.addEventListener('visibilitychange', () => setHiddenState(document.hidden));
    prepareImages();
    const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) prepareImages(node);
    })));
    observer.observe(document.body, { childList: true, subtree: true });
}

// Page event handlers
document.addEventListener('DOMContentLoaded', () => {
    AeroAPI.initAppState();
    setupPresenceHeartbeat();
    setupNotificationDrawer();
    setupMediaAndChat();
    setupSearchInteraction();
    setupSearchPage();
    setupCreatePostExperience();
    setupPostScrollBehavior();
    setupPageVisibilitySaver();

    // Sign in and sign up toggle
    const toSignUpBtn = document.getElementById('to-signup-btn');
    const toSignInBtn = document.getElementById('to-signin-btn');
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');

    if (toSignUpBtn) {
        toSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signinForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        });
    }

    if (toSignInBtn) {
        toSignInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signupForm.classList.add('hidden');
            signinForm.classList.remove('hidden');
        });
    }

    // Auth form submission
    if (signinForm) {
        signinForm.addEventListener('submit', (e) => {
            e.preventDefault();
            AeroAPI.signin(
                document.getElementById('signin-username').value,
                document.getElementById('signin-password').value
            );
        });
    }

    if (signupForm) {
        const passwordInput = document.getElementById('signup-password');
        const confirmInput = document.getElementById('signup-confirm-password');
        const strengthBar = document.getElementById('password-strength-bar');
        const strengthLabel = document.getElementById('password-strength-label');
        const requirements = {
            length: value => value.length >= 8,
            uppercase: value => /[A-Z]/.test(value),
            number: value => /\d/.test(value),
            special: value => /[@$!%*?&]/.test(value)
        };

        const updatePasswordFeedback = () => {
            const value = passwordInput.value;
            let satisfied = 0;
            Object.entries(requirements).forEach(([name, test]) => {
                const item = signupForm.querySelector(`[data-requirement="${name}"]`);
                const valid = test(value);
                satisfied += valid ? 1 : 0;
                item.classList.toggle('is-met', valid);
            });
            const level = satisfied >= 4 ? 'strong' : satisfied >= 2 ? 'medium' : satisfied ? 'weak' : '';
            strengthBar.style.width = `${satisfied * 25}%`;
            strengthBar.dataset.level = level;
            strengthLabel.textContent = level ? level[0].toUpperCase() + level.slice(1) : 'Enter a password';
            strengthLabel.dataset.level = level;
        };

        const validatePasswordMatch = () => {
            const mismatch = confirmInput.value.length > 0 && confirmInput.value !== passwordInput.value;
            confirmInput.classList.toggle('has-error', mismatch);
            document.getElementById('password-match-error').classList.toggle('is-visible', mismatch);
            return !mismatch;
        };

        passwordInput.addEventListener('input', updatePasswordFeedback);
        confirmInput.addEventListener('blur', validatePasswordMatch);
        confirmInput.addEventListener('input', validatePasswordMatch);
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!validatePasswordMatch()) return;
            AeroAPI.signup(
                document.getElementById('signup-username').value,
                document.getElementById('signup-email').value,
                document.getElementById('signup-password').value,
                document.getElementById('signup-confirm-password').value
            );
        });
    }

    const onboardingForm = document.getElementById('profile-onboarding-form');
    const avatarInput = document.getElementById('profile-avatar-input');
    let avatarFile = null;
    if (avatarInput) avatarInput.addEventListener('change', () => {
        avatarFile = avatarInput.files[0] || null;
        if (avatarFile) {
            const preview = document.getElementById('profile-avatar-preview');
            preview.style.backgroundImage = `url(${URL.createObjectURL(avatarFile)})`;
            preview.classList.add('has-image');
            preview.innerHTML = '';
        }
    });
    document.getElementById('profile-bio')?.addEventListener('input', (event) => {
        document.getElementById('profile-bio-count').textContent = `${event.target.value.length} / 150`;
    });
    const finishOnboarding = () => {
        sessionStorage.removeItem('aero_profile_onboarding');
        document.getElementById('profile-onboarding-overlay')?.classList.add('hidden');
    };
    document.getElementById('skip-profile-btn')?.addEventListener('click', finishOnboarding);
    onboardingForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = onboardingForm.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const avatarUrl = avatarFile ? await AeroAPI.uploadMedia(avatarFile) : '';
            await AeroAPI.updateProfile({ bio: document.getElementById('profile-bio').value, avatar_url: avatarUrl });
            finishOnboarding();
        } catch (error) {
            showNotice(error.message, 'error');
        } finally {
            button.disabled = false;
        }
    });

    const deleteModal = document.getElementById('delete-modal-overlay');
    const closeDeleteModal = () => {
        deleteModal?.classList.add('hidden');
        if (deleteModal) deleteModal.dataset.postId = '';
    };
    document.getElementById('cancel-delete-btn')?.addEventListener('click', closeDeleteModal);
    deleteModal?.addEventListener('click', event => {
        if (event.target === deleteModal) closeDeleteModal();
    });
    document.getElementById('confirm-delete-btn')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        const postId = deleteModal?.dataset.postId;
        if (!postId || button.disabled) return;
        button.disabled = true;
        try {
            await AeroAPI.deletePost(postId);
            closeDeleteModal();
        } catch (error) {
            showNotice(error.message, 'error');
        } finally {
            button.disabled = false;
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && deleteModal && !deleteModal.classList.contains('hidden')) closeDeleteModal();
    });

    // Sign out
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.setFabAuthState?.(false);
            window.AeroStopNotificationRealtime?.();
            window.AeroSupabaseSignOut?.().catch(() => {});
            ['aero_token', 'token', 'aero_user', 'currentUser'].forEach((key) => localStorage.removeItem(key));
            location.reload();
        });
    }
});

document.addEventListener('click', event => {
    if (!event.target.closest('.post-more-btn') && !event.target.closest('.post-dropdown-menu, .post-menu')) {
        closeAllPostMenus();
    }
});

window.addEventListener('scroll', closeAllPostMenus, { passive: true });