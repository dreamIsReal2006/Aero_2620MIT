const API_BASE = window.location.protocol === 'file:'
    ? 'http://127.0.0.1:5000/api'
    : `${window.location.origin}/api`;
const API_ORIGIN = API_BASE.replace(/\/api$/, '');

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

function formatRelativeTime(timestamp) {
    const normalizedTimestamp = typeof timestamp === 'string' && timestamp && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(timestamp)
        ? `${timestamp}Z`
        : timestamp;
    const elapsedSeconds = Math.max(0, (Date.now() - new Date(normalizedTimestamp).getTime()) / 1000);
    if (elapsedSeconds < 60) return '刚刚';
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}个月`;
    return `${Math.floor(months / 12)}年`;
}

function createAvatarElement(username, avatarUrl, className = 'post-avatar') {
    const avatar = document.createElement('span');
    avatar.className = className;
    avatar.setAttribute('aria-hidden', 'true');
    const name = String(username || 'User');
    if (!avatarUrl) {
        avatar.textContent = name.charAt(0).toUpperCase();
        return avatar;
    }

    const image = document.createElement('img');
    image.src = avatarUrl.startsWith('http') ? avatarUrl : `${API_ORIGIN}${avatarUrl}`;
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => {
        avatar.textContent = name.charAt(0).toUpperCase();
        avatar.classList.remove('has-image');
    };
    avatar.appendChild(image);
    avatar.classList.add('has-image');
    return avatar;
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
        const nextAvatar = createAvatarElement(user.username, user.avatar_url, className);
        nextAvatar.id = id;
        currentAvatar.replaceWith(nextAvatar);
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
        dropdown.innerHTML = '<div class="search-empty">No results found</div>';
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
                <button type="button" class="user-action-btn" data-action="visit">Visit</button>
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

    const footerText = query ? `Press Enter or Click to see all results for "${escapeHtml(query)}"` : 'Press Enter or Click to see all results';

    dropdown.innerHTML = `
        <section class="search-section">
            <div class="search-section-header">
                <span>Users</span>
            </div>
            <div class="search-result-list">${usersMarkup || '<div class="search-item"><span class="search-query">No users found</span></div>'}</div>
        </section>
        <section class="search-section">
            <div class="search-section-header">
                <span>Posts / Topics</span>
            </div>
            <div class="search-result-list">${postsMarkup || '<div class="search-item"><span class="search-query">No posts found</span></div>'}</div>
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
            return `
                <article class="search-page-card search-user-card" data-navigate="/profile/${encodeURIComponent(username)}" tabindex="0" role="button" aria-label="Open profile for ${escapeHtml(username)}">
                    <div class="search-page-avatar">${escapeHtml(username).slice(0, 1).toUpperCase()}</div>
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
            <article class="search-page-card search-post-card" data-navigate="/post/${encodeURIComponent(item.id || '')}" tabindex="0" role="button" aria-label="Open post by ${escapeHtml(author)}">
                <div class="search-page-copy">
                    <div class="search-page-title">${highlightMatch(content, query)}</div>
                    <div class="search-page-meta">by ${highlightMatch(author, query)}</div>
                </div>
                <span class="search-page-tag">Post</span>
            </article>
        `;
    }).join('');

    feed.innerHTML = itemMarkup;

    feed.querySelectorAll('[data-navigate]').forEach((card) => {
        const go = () => {
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
            headers: { 'Accept': 'application/json' }
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
            headers: { 'Accept': 'application/json' }
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
        window.location.href = `/post/${encodeURIComponent(postId)}`;
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
            closeSearchPanel();
        }
    });

    document.addEventListener('keydown', (event) => {
        const metaKey = event.metaKey || event.ctrlKey;
        if (metaKey && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            openSearchPanel();
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

function setBookmarkDrawerVisibility(isOpen) {
    const drawer = document.getElementById('bookmarks-drawer');
    const dockButton = document.getElementById('bookmark-dock-btn');
    if (!drawer || !dockButton) return;
    drawer.classList.toggle('hidden', !isOpen);
    dockButton.classList.toggle('active', isOpen);
}

let notificationItems = [];
let notificationTab = 'all';

function setNotificationDrawerVisibility(isOpen) {
    const drawer = document.getElementById('notifications-drawer');
    const button = document.getElementById('notification-dock-btn');
    if (!drawer || !button) return;
    drawer.classList.toggle('hidden', !isOpen);
    button.classList.toggle('active', isOpen);
}

function renderNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    const items = notificationItems.filter((item) => notificationTab === 'all' || item.type === notificationTab || (notificationTab === 'mentions' && item.type === 'mention'));
    list.innerHTML = items.length ? items.map((item) => {
        const actor = item.actor || {};
        const icon = item.type === 'like' ? '♥' : item.type === 'comment' ? '●' : item.type === 'follow' ? '●' : '↗';
        const avatarUrl = actor.avatar_url ? (actor.avatar_url.startsWith('http') ? actor.avatar_url : `${API_ORIGIN}${actor.avatar_url}`) : '';
        const avatar = avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" onerror="this.remove()">` : escapeHtml((actor.username || 'S').charAt(0).toUpperCase());
        return `<article class="notification-item" data-post-id="${item.post_id || ''}" tabindex="0"><span class="notification-avatar">${avatar}</span><div class="notification-copy"><strong>@${escapeHtml(actor.username || 'Someone')}</strong><span>${escapeHtml(item.message || `${item.type} your post`)}</span><time>${formatRelativeTime(item.created_at)}</time><p>${escapeHtml(item.post_content || '')}</p></div><span class="notification-type-icon">${icon}</span></article>`;
    }).join('') : '<div class="bookmarks-empty">No notifications yet.</div>';
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
        const badge = document.querySelector('#notification-dock-btn .dock-badge');
        badge?.classList.toggle('hidden', !(data.unread_count > 0));
        renderNotifications();
        if (markRead) {
            await fetch(`${API_BASE}/notifications/read-all`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
        }
    } catch (error) {
        const list = document.getElementById('notifications-list');
        if (list) list.innerHTML = `<div class="bookmarks-empty">${escapeHtml(error.message)}</div>`;
    }
}

function setupNotificationDrawer() {
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
    if (localStorage.getItem('aero_token')) loadNotifications(false);
}

let activeChatUser = null;
let chatPollTimer = null;

async function loadShortVideos() {
    const feed = document.getElementById('video-feed');
    if (!feed) return;
    try {
        const response = await fetch(`${API_BASE}/videos`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
        const videos = await response.json();
        if (!response.ok) throw new Error(videos.message || 'Unable to load videos');
        feed.innerHTML = videos.length ? videos.map((video) => `<article class="short-video-card"><video src="${escapeHtml(video.video_url)}" playsinline loop preload="metadata"></video><div class="short-video-overlay"><button type="button" class="video-action" aria-label="Like video">♥</button><button type="button" class="video-action" aria-label="Comment on video">●</button><button type="button" class="video-action" aria-label="Share video">↗</button></div><div class="short-video-meta"><span class="video-author-avatar">${escapeHtml((video.author?.username || 'U').charAt(0).toUpperCase())}</span><div><strong>@${escapeHtml(video.author?.username || 'User')}</strong><p>${escapeHtml(video.caption || '')}</p><small>♫ ${escapeHtml(video.track_name || 'Original audio')}</small></div><button type="button" class="video-mute-btn" aria-label="Mute video">🔊</button></div></article>`).join('') : '<div class="bookmarks-empty">No short videos yet.</div>';
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
    const response = await fetch(`${API_BASE}/chat/contacts`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
    const contacts = await response.json();
    list.innerHTML = (contacts || []).map((contact) => `<button type="button" class="chat-contact ${contact.unread_count ? 'unread' : ''}" data-user-id="${contact.id}"><span class="chat-contact-avatar">${escapeHtml((contact.username || 'U').charAt(0).toUpperCase())}</span><span><strong>@${escapeHtml(contact.username)}</strong><small>${escapeHtml(contact.latest_message || 'Start a conversation')}</small></span></button>`).join('') || '<div class="bookmarks-empty">No contacts yet.</div>';
    list.querySelectorAll('.chat-contact').forEach((item) => item.addEventListener('click', () => selectChatContact(contacts.find((contact) => String(contact.id) === item.dataset.userId))));
}

async function selectChatContact(contact) {
    if (!contact) return;
    activeChatUser = contact;
    window.activeChatUser = contact;
    document.getElementById('chat-active-header').textContent = `@${contact.username}`;
    await loadChatMessages();
    window.clearInterval(chatPollTimer);
    chatPollTimer = window.setInterval(loadChatMessages, 5000);
}

async function loadChatMessages() {
    const contact = activeChatUser || window.activeChatUser;
    if (!contact) return;
    const response = await fetch(`${API_BASE}/chat/messages?contact_id=${contact.id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
    const messages = await response.json();
    const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
    const box = document.getElementById('chat-messages-list') || document.getElementById('chat-messages');
    box.innerHTML = (messages || []).map((message) => `<div class="chat-message ${message.sender_id === currentUser.id ? 'mine' : ''}">${escapeHtml(message.content)}</div>`).join('');
    box.scrollTop = box.scrollHeight;
}

function setupMediaAndChat() {
    document.getElementById('chat-dock-btn')?.addEventListener('click', () => { window.AeroRouter?.navigate('chat'); loadChatContacts(); });
    document.getElementById('close-chat-drawer')?.addEventListener('click', () => { document.getElementById('view-chat').classList.add('hidden'); window.clearInterval(chatPollTimer); });
    document.getElementById('chat-contact-search')?.addEventListener('input', (event) => document.querySelectorAll('.chat-contact').forEach((item) => item.classList.toggle('hidden', !item.textContent.toLowerCase().includes(event.target.value.toLowerCase()))));
    const getChatInput = () => document.getElementById('chat-input') || document.getElementById('chat-message-input');
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
        if (!contact || (!content && !mediaUrl)) return;
        const box = document.getElementById('chat-messages-list') || document.getElementById('chat-messages');
        if (box) {
            const message = document.createElement('div');
            message.className = 'chat-message mine';
            const gif = window.parseGifContent?.(content, mediaUrl, input.dataset.messageType) || { url: mediaUrl, text: content };
            message.innerHTML = `<div class="chat-bubble-content">${gif.url ? `<img src="${escapeHtml(gif.url)}" class="chat-gif-media" alt="GIF" loading="lazy">` : ''}${gif.text ? escapeHtml(gif.text) : ''}</div>`;
            box.appendChild(message);
            box.scrollTop = box.scrollHeight;
        }
        const response = await fetch(`${API_BASE}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }, body: JSON.stringify({ user_id: contact.id, recipient_id: contact.id, content, media_url: mediaUrl, type: input.dataset.messageType || 'text' }) });
        if (response.ok) { input.value = ''; delete input.dataset.mediaUrl; delete input.dataset.messageType; await loadChatMessages(); }
    });
}

function createBookmarkItemMarkup(post) {
    const authorName = post.username || 'User';
    const avatarUrl = post.author_avatar || post.avatar_url || post.user?.avatar_url || '/static/default-avatar.png';
    const excerpt = (post.content || '').trim() || 'Saved post';
    const createdAt = formatRelativeTime(post.created_at);
    return `
        <article class="bookmark-item" data-bookmark-id="${post.id}">
            <span class="bookmark-item-avatar" aria-hidden="true"><img src="${escapeHtml(avatarUrl.startsWith('http') ? avatarUrl : `${API_ORIGIN}${avatarUrl}`)}" alt="" onerror="this.remove()">${escapeHtml(authorName).slice(0, 1).toUpperCase()}</span>
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

    list.innerHTML = '<div class="bookmarks-empty"><div class="bookmarks-empty-icon">★</div><div>Loading bookmarks...</div></div>';
    try {
        const posts = await AeroAPI.getBookmarkedPosts();
        if (!posts || posts.length === 0) {
            list.innerHTML = `
                <div class="bookmarks-empty">
                    <div class="bookmarks-empty-icon">☆</div>
                    <div>No bookmarks saved yet.</div>
                </div>
            `;
            return;
        }

        list.innerHTML = posts.map(createBookmarkItemMarkup).join('');
        list.querySelectorAll('.bookmark-item-remove').forEach((button) => {
            button.addEventListener('click', async () => {
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
                                    <div>No bookmarks saved yet.</div>
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
                this.transitionToApp();
            } else {
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
        localStorage.setItem('aero_user', JSON.stringify(data.user));
        return data.user;
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
    async fetchPosts(feedType = 'for_you') {
        try {
            const type = feedType === 'following' ? 'following' : 'for_you';
            const res = await fetch(`${API_BASE}/posts?feed_type=${encodeURIComponent(type)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
            });
            return await res.json();
        } catch (err) {
            return [];
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
        return `${API_ORIGIN}${data.url}`;
    },

    async deletePost(postId) {
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
        const res = await fetch(`${API_BASE}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to load admin statistics');
        return data;
    },

    async getAdminReports() {
        const res = await fetch(`${API_BASE}/admin/reports`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to load reports');
        return data;
    },

    async adminDeletePost(postId) {
        const res = await fetch(`${API_BASE}/admin/posts/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to delete post');
        return data;
    },

    async adminToggleBan(userId) {
        const res = await fetch(`${API_BASE}/admin/users/${userId}/ban`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to update user status');
        return data;
    },

    showReportModal(postId) {
        let overlay = document.getElementById('report-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'report-modal-overlay';
            overlay.className = 'report-modal-overlay';
            overlay.innerHTML = `<div class="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
                <div class="report-modal-header"><h2 id="report-modal-title">Report post</h2><button type="button" class="report-close" aria-label="Close report dialog">&times;</button></div>
                <form class="report-form"><label for="report-reason">Why are you reporting this?</label><textarea id="report-reason" maxlength="1000" required placeholder="Tell us what is wrong..."></textarea><div class="report-form-actions"><button type="button" class="report-cancel-btn">Cancel</button><button type="submit" class="report-submit-btn">Submit report</button></div></form>
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
        const res = await fetch(`${API_ORIGIN}/interact/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to like post');
        return data;
    },

    async cancelLikePost(postId) {
        const res = await fetch(`${API_ORIGIN}/interact/posts/${postId}/like`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to remove like');
        return data;
    },

    async toggleFollow(userId, userMeta = {}) {
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

    async sendPostToUser(postId, username) {
        const res = await fetch(`${API_BASE}/posts/${postId}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Unable to share with user');
        return data;
    },

    async getComments(postId) {
        const res = await fetch(`${API_ORIGIN}/interact/posts/${postId}/comments`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to load comments');
        return data.comments || [];
    },

    async sendComment(postId, content, parentId = null, imageUrl = '') {
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
        const res = await fetch(`${API_BASE}/comments/${commentId}/like`, {
            method: liked ? 'DELETE' : 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to update comment like');
        return data;
    },

    // Feed rendering and DOM updates
    async renderFeed(feedType = 'for_you') {
        const feedContainer = document.getElementById('posts-feed');
        if (!feedContainer) return;

        feedContainer.innerHTML = '';
        const posts = await this.fetchPosts(feedType);

        if (!posts || posts.length === 0) {
            feedContainer.innerHTML = `<div class="post-card glass-card text-center"><p>No posts available yet.</p></div>`;
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
        posts.forEach(post => {
            const postEl = document.createElement('div');
            postEl.className = 'post-card glass-card pop-in g2-card';
            postEl.dataset.postId = String(post.id);
            const header = document.createElement('div');
            header.className = 'post-header';
            const authorIdentity = document.createElement('div');
            authorIdentity.className = 'post-author-identity';
            authorIdentity.appendChild(createAvatarElement(post.username, post.avatar_url));
            const author = document.createElement('span');
            author.className = 'post-author';
            author.textContent = post.username || 'User';
            authorIdentity.appendChild(author);
            const postTime = document.createElement('time');
            postTime.className = 'post-relative-time';
            postTime.dateTime = post.created_at || '';
            postTime.textContent = formatRelativeTime(post.created_at);
            authorIdentity.appendChild(postTime);
            header.appendChild(authorIdentity);
            const moreButton = document.createElement('button');
            moreButton.className = 'icon-btn post-more-btn';
            moreButton.type = 'button';
            moreButton.setAttribute('aria-label', 'Post options');
            moreButton.title = 'Post options';
            moreButton.textContent = '\u22ee';
            const optionsMenu = document.createElement('div');
            optionsMenu.className = 'post-dropdown-menu post-menu';
            const isOwnPost = post.user_id === currentUser.id;
            const isAdmin = currentUser.is_admin === true;
            const openDeleteModal = () => {
                const overlay = document.getElementById('delete-modal-overlay');
                if (!overlay) return;
                overlay.dataset.postId = String(post.id);
                overlay.classList.remove('hidden');
                document.getElementById('confirm-delete-btn')?.focus();
            };
            const addMenuItem = (label, iconPath, action, danger = false) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.appendChild(createIcon(iconPath, label));
                item.append(` ${label}`);
                item.classList.toggle('danger', danger);
                if (label === 'Bookmark Post' || label === 'Remove Bookmark') {
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
            });
            addMenuItem('Copy Link', '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"></path>', () => copyPostLink(post.id));
            addMenuItem('Not Interested', '<path d="M4 4l16 16M20 4 4 20"></path>', async () => {
                postEl.classList.add('post-removing');
                try {
                    await this.markNotInterested(post.id);
                    window.setTimeout(() => postEl.remove(), 240);
                } catch (error) {
                    postEl.classList.remove('post-removing');
                    showNotice(error.message, 'error');
                }
            });
            const separator = document.createElement('div');
            separator.className = 'post-menu-separator';
            optionsMenu.appendChild(separator);
            if (!isOwnPost) {
                addMenuItem(`${post.is_following ? 'Unfollow' : 'Follow'} @${post.username || 'user'}`, '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M19 8v6M22 11h-6"></path>', async () => {
                    try {
                        const result = await this.toggleFollow(post.user_id, { username: post.username, name: post.username, avatar: post.avatar_url });
                        showNotice(result.is_following ? `Following @${post.username}.` : `Unfollowed @${post.username}.`, 'success');
                    } catch (error) { showNotice(error.message, 'error'); }
                });
            }
            if (isAdmin || isOwnPost) addMenuItem(isAdmin && !isOwnPost ? 'Delete Post (Admin)' : 'Delete Post', '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"></path>', openDeleteModal, true);
            addMenuItem('Report Post', '<path d="M5 21V4m0 0c4-3 7 3 14 0v10c-7 3-10-3-14 0"></path>', () => this.showReportModal(post.id), true);
            moreButton.addEventListener('click', event => {
                event.stopPropagation();
                const shouldOpen = !optionsMenu.classList.contains('show');
                closeAllPostMenus(optionsMenu);
                optionsMenu.classList.toggle('show', shouldOpen);
            });
            header.append(moreButton, optionsMenu);
            const content = document.createElement('div');
            content.className = 'post-content';
            content.textContent = post.content;
            postEl.append(header, content);
            if (post.images && post.images.length) {
                const media = document.createElement('div');
                media.className = 'post-media-grid';
                post.images.slice(0, 3).forEach(mediaUrl => {
                    const isVideo = /\.(mp4|webm|mov)(?:$|\?)/i.test(mediaUrl);
                    const mediaElement = document.createElement(isVideo ? 'video' : 'img');
                    mediaElement.src = mediaUrl;
                    mediaElement.alt = isVideo ? '' : 'Post media';
                    mediaElement.loading = 'lazy';
                    if (isVideo) {
                        mediaElement.controls = true;
                        mediaElement.preload = 'metadata';
                    }
                    media.appendChild(mediaElement);
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
            composer.querySelector('.comment-composer-avatar').replaceWith(createAvatarElement(composerUser.username, composerUser.avatar_url, 'comment-composer-avatar'));
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
                meta.textContent = `@${comment.username || `user${comment.user_id}`}`;
                const time = document.createElement('time');
                time.className = 'comment-relative-time';
                time.dateTime = comment.created_at || '';
                time.textContent = formatRelativeTime(comment.created_at);
                const authorTag = document.createElement('span');
                authorTag.className = 'comment-author-tag';
                authorTag.textContent = comment.user_id === post.user_id ? '· 作者' : '';
                const metaLine = document.createElement('div');
                metaLine.className = 'comment-meta-line';
                metaLine.append(meta, time, authorTag);
                commentHeader.append(avatarWrap, metaLine);
                const body = document.createElement('p');
                body.textContent = comment.content;
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
                commentActions.append(likeButton, replyButton, repostButton, shareButton);
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
                commentsList.innerHTML = '<p class="comments-loading">Loading comments...</p>';
                try {
                    const comments = await this.getComments(post.id);
                    commentsList.innerHTML = '';
                    if (!comments.length) {
                        commentsList.innerHTML = '<p class="comments-empty">No comments yet.</p>';
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
    },

    initAppState() {
        const homeButton = document.getElementById('home-nav-btn');
        const logoButton = document.getElementById('aero-logo');
        const bookmarkDockButton = document.getElementById('bookmark-dock-btn');
        const bookmarkCloseButton = document.getElementById('close-bookmarks-drawer');

        bookmarkDockButton?.addEventListener('click', () => {
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
        const token = localStorage.getItem('aero_token');
        const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
        const adminLink = document.getElementById('admin-dashboard-link');
        if (adminLink) adminLink.classList.toggle('hidden', user.is_admin !== true);
        
        const authOverlay = document.getElementById('auth-overlay');
        const mainApp = document.getElementById('main-app');

        if (token && mainApp) {
            window.setFabAuthState?.(true);
            if (authOverlay) authOverlay.classList.add('hidden');
            mainApp.classList.remove('hidden');
            document.getElementById('nav-username').innerText = user.username || 'User';
            syncCurrentUserAvatars(user);
            this.renderFeed();
            if (sessionStorage.getItem('aero_profile_onboarding') === '1') {
                document.getElementById('profile-onboarding-overlay')?.classList.remove('hidden');
            }
        } else if (authOverlay) {
            window.setFabAuthState?.(false);
            authOverlay.classList.remove('hidden');
            if (mainApp) mainApp.classList.add('hidden');
        }
    },

    transitionToApp() {
        const authOverlay = document.getElementById('auth-overlay');
        const mainApp = document.getElementById('main-app');
        if (!authOverlay || !mainApp) return;

        const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
        window.setFabAuthState?.(true);
        const adminLink = document.getElementById('admin-dashboard-link');
        if (adminLink) adminLink.classList.toggle('hidden', user.is_admin !== true);
        authOverlay.classList.remove('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('app-entering');
        authOverlay.classList.add('is-exiting');
        document.getElementById('nav-username').textContent = user.username || 'User';
        syncCurrentUserAvatars(user);
        this.renderFeed();

        window.setTimeout(() => {
            authOverlay.classList.add('hidden');
            authOverlay.classList.remove('is-exiting');
            mainApp.classList.remove('app-entering');
        }, 460);
    }
};

window.AeroAPI = AeroAPI;
window.apiService = AeroAPI;
window.toggleFollowUser = async (userId, userMeta = {}) => {
    const api = window.apiService || window.api;
    if (api && typeof api.toggleFollow === 'function') return api.toggleFollow(userId, userMeta);
    const apiOrigin = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000' : window.location.origin;
    const response = await fetch(`${apiOrigin}/api/users/${userId}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Unable to update follow status');
    return data;
};

function closeAllPostMenus(exceptMenu = null) {
    document.querySelectorAll('.post-dropdown-menu, .post-menu').forEach(menu => {
        if (menu !== exceptMenu) {
            menu.classList.remove('show');
        }
    });
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
        overlay.innerHTML = `<div class="share-modal glass-card" role="dialog" aria-modal="true" aria-labelledby="share-modal-title"><header class="share-modal-header"><div><span class="share-modal-kicker">Aero share</span><h2 id="share-modal-title">Share this post</h2></div><button type="button" class="modal-close-btn share-modal-close" aria-label="Close share dialog">&times;</button></header><p class="share-modal-preview"></p><div class="share-shortcuts"><button type="button" data-share-action="copy"><span class="share-shortcut-icon">⌁</span><strong>Copy Link</strong><small>Copy the post URL</small></button><button type="button" data-share-action="export"><span class="share-shortcut-icon">▧</span><strong>Export as Card</strong><small>Download an image</small></button><button type="button" data-share-action="send"><span class="share-shortcut-icon">➤</span><strong>Send to User</strong><small>Share privately</small></button></div><div class="share-send-form hidden"><input type="text" placeholder="Username" aria-label="Recipient username"><button type="button" class="btn btn-primary g2-btn">Send</button></div></div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.classList.remove('is-open');
        overlay.querySelector('.share-modal-close').addEventListener('click', close);
        overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
        overlay.querySelector('[data-share-action="copy"]').addEventListener('click', () => copyPostLink(overlay.dataset.postId));
        overlay.querySelector('[data-share-action="export"]').addEventListener('click', () => {
            exportPostCard(overlay.dataset.postId, overlay.dataset.content, overlay.dataset.username);
            AeroAPI.recordShareStats(overlay.dataset.postId, 'share').catch(() => {});
        });
        overlay.querySelector('[data-share-action="send"]').addEventListener('click', () => overlay.querySelector('.share-send-form').classList.toggle('hidden'));
        overlay.querySelector('.share-send-form button').addEventListener('click', () => {
            const recipient = overlay.querySelector('.share-send-form input').value.trim();
            if (recipient) {
                AeroAPI.sendPostToUser(overlay.dataset.postId, recipient)
                    .then(() => { close(); showNotice(`Post shared with @${recipient}.`, 'success'); })
                    .catch(error => showNotice(error.message, 'error'));
            }
        });
    }
    overlay.dataset.postId = String(post.id);
    overlay.dataset.content = post.content || '';
    overlay.dataset.username = post.username || 'User';
    overlay.querySelector('.share-modal-preview').textContent = `${post.username || 'User'}: ${post.content || 'Aero post'}`;
    overlay.classList.add('is-open');
}

function exportPostCard(postId, content, username) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f4f7f8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#17252b';
    context.font = '700 42px sans-serif';
    context.fillText('Aero', 72, 100);
    context.font = '600 28px sans-serif';
    context.fillText(`@${username}`, 72, 170);
    context.font = '32px sans-serif';
    context.fillStyle = '#33454d';
    String(content || '').match(/.{1,55}/g)?.slice(0, 8).forEach((line, index) => context.fillText(line, 72, 250 + index * 48));
    const link = document.createElement('a');
    link.download = `aero-post-${postId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showNotice('Card image downloaded.', 'success');
}



const createPostState = { files: [] };

function updateCreatePostState() {
    const preview = document.getElementById('modal-preview');
    const button = document.getElementById('modal-publish-btn');
    const input = document.getElementById('modal-post-input');
    if (!preview || !button) return;
    preview.replaceChildren();
    preview.classList.toggle('has-media', createPostState.files.length > 0);
    createPostState.files.forEach((file, index) => {
        const card = document.createElement('div');
        card.className = 'media-preview-item';
        const objectUrl = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video/');
        const media = document.createElement(isVideo ? 'video' : 'img');
        media.src = objectUrl;
        media.alt = isVideo ? '' : file.name;
        if (isVideo) {
            media.autoplay = true;
            media.muted = true;
            media.loop = true;
            media.playsInline = true;
            const overlay = document.createElement('span');
            overlay.className = 'media-preview-video-icon';
            overlay.textContent = '▶';
            card.appendChild(overlay);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'media-remove-btn';
        remove.textContent = '✕';
        remove.setAttribute('aria-label', `Remove ${file.name}`);
        remove.addEventListener('click', () => {
            URL.revokeObjectURL(objectUrl);
            createPostState.files.splice(index, 1);
            updateCreatePostState();
        });
        card.append(media, remove);
        preview.appendChild(card);
    });
    button.disabled = !input?.value.trim() && createPostState.files.length === 0;
}

function openCreatePostModal() {
    const modal = document.getElementById('create-post-modal');
    if (!modal) return;
    const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
    document.getElementById('create-post-username').textContent = user.username || 'User';
    syncCurrentUserAvatars(user);
    modal.classList.remove('hidden');
    document.getElementById('modal-post-input')?.focus();
}

async function publishCreatePost() {
    const input = document.getElementById('modal-post-input');
    const button = document.getElementById('modal-publish-btn');
    const content = input?.value.trim() || '';
    if (!content && !createPostState.files.length) return;
    button.disabled = true;
    try {
        const mediaUrls = await Promise.all(createPostState.files.map(file => AeroAPI.uploadMedia(file)));
        await AeroAPI.createPost(content, mediaUrls);
        createPostState.files = [];
        input.value = '';
        updateCreatePostState();
        document.getElementById('create-post-modal').classList.add('hidden');
        await AeroAPI.renderFeed();
    } catch (error) {
        showNotice(error.message, 'error');
        updateCreatePostState();
    }
}

function setupCreatePostExperience() {
    const modal = document.getElementById('create-post-modal');
    const fileInput = document.getElementById('modal-post-images');
    const input = document.getElementById('modal-post-input');
    document.getElementById('compose-trigger')?.addEventListener('click', openCreatePostModal);
    document.getElementById('compose-trigger')?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCreatePostModal(); }
    });
    document.getElementById('compose-trigger-media')?.addEventListener('click', event => { event.stopPropagation(); openCreatePostModal(); });
    document.getElementById('global-fab-btn')?.addEventListener('click', openCreatePostModal);
    document.getElementById('close-create-post')?.addEventListener('click', () => modal?.classList.add('hidden'));
    modal?.addEventListener('click', event => { if (event.target === modal) modal.classList.add('hidden'); });
    fileInput?.addEventListener('change', () => {
        createPostState.files = [...createPostState.files, ...Array.from(fileInput.files || [])].slice(0, 10);
        fileInput.value = '';
        updateCreatePostState();
    });
    input?.addEventListener('input', updateCreatePostState);
    document.getElementById('create-post-form')?.addEventListener('submit', event => { event.preventDefault(); publishCreatePost(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal && !modal.classList.contains('hidden')) modal.classList.add('hidden');
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

// Page event handlers
document.addEventListener('DOMContentLoaded', () => {
    AeroAPI.initAppState();
    setupNotificationDrawer();
    setupMediaAndChat();
    setupSearchInteraction();
    setupSearchPage();
    setupCreatePostExperience();
    setupPostScrollBehavior();

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
            localStorage.clear();
            location.reload();
        });
    }
});

document.addEventListener('click', event => {
    if (!event.target.closest('.post-more-btn') && !event.target.closest('.post-dropdown-menu, .post-menu')) {
        closeAllPostMenus();
    }
});