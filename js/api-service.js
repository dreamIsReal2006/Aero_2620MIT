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
            <div class="search-result-item search-item ${index === searchState.highlightedIndex ? 'active' : ''}" data-type="user" data-index="${index}" data-username="${escapeHtml(name)}">
                <div class="user-result">
                    <div class="user-avatar">${escapeHtml(name).slice(0, 1).toUpperCase()}</div>
                    <div class="user-details">
                        <span class="user-name">${highlightMatch(name, query)}</span>
                        <span class="user-subline">${highlightMatch(tag, query)}</span>
                    </div>
                </div>
                <button type="button" class="user-action-btn">Visit</button>
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
    const feed = document.getElementById('feed-container');
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
    const postId = item.dataset.postId;

    if (type === 'user' && username) {
        window.location.href = `/profile/${encodeURIComponent(username)}`;
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
        const item = event.target.closest('.search-result-item');
        if (!item) return;
        searchState.ignoreBlur = true;
        event.preventDefault();
        triggerSearchItemNavigation(item);
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

function showNotice(message, type = 'info') {
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
                <button class="notice-close" type="button" aria-label="Close notification" title="Close notification">&times;</button>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.notice-close').addEventListener('click', () => closeNotice(overlay));
    }

    const dialog = overlay.querySelector('.notice-dialog');
    const icon = overlay.querySelector('.notice-icon');
    const title = overlay.querySelector('#notice-title');
    const messageElement = overlay.querySelector('#notice-message');
    const icons = {
        success: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>',
        error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="m9 9 6 6m0-6-6 6"></path></svg>',
        info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="M12 10v5m0-8v.1"></path></svg>'
    };
    icon.innerHTML = icons[type] || icons.info;
    title.textContent = type === 'success' ? 'All set' : type === 'error' ? 'Something went wrong' : 'Aero';
    messageElement.textContent = message;
    dialog.dataset.type = type;
    overlay.classList.remove('hidden', 'is-closing');
    window.clearTimeout(overlay.noticeTimer);
    overlay.noticeTimer = window.setTimeout(() => closeNotice(overlay), 4200);
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

    async signup(username, email, password) {
        try {
            const res = await fetch(`${API_BASE}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
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
    async fetchPosts() {
        try {
            const res = await fetch(`${API_BASE}/posts`, {
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

    async getComments(postId) {
        const res = await fetch(`${API_ORIGIN}/interact/posts/${postId}/comments`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to load comments');
        return data.comments || [];
    },

    async sendComment(postId, content, parentId = null) {
        const res = await fetch(`${API_ORIGIN}/interact/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('aero_token')}`
            },
            body: JSON.stringify({ content, parentId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Unable to send comment');
        return data;
    },

    // Feed rendering and DOM updates
    async renderFeed() {
        const feedContainer = document.getElementById('posts-feed');
        if (!feedContainer) return;

        feedContainer.innerHTML = '';
        const posts = await this.fetchPosts();

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
            const addMenuItem = (label, action, danger = false) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.textContent = label;
                item.classList.toggle('danger', danger);
                item.addEventListener('click', () => {
                    closeAllPostMenus();
                    action();
                });
                optionsMenu.appendChild(item);
            };
            if (isAdmin) {
                addMenuItem('Delete Post (Admin)', openDeleteModal, true);
                addMenuItem('Report Post', () => this.showReportModal(post.id));
            } else if (isOwnPost) addMenuItem('Delete Post', openDeleteModal, true);
            else addMenuItem('Report Post', () => this.showReportModal(post.id));
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
            actions.append(likeButton, commentButton);
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
            composer.innerHTML = '<input type="text" maxlength="1000" placeholder="Write a comment..." aria-label="Comment text"><button type="submit" class="btn btn-primary">Send</button>';
            commentsPanel.append(commentsList, replyStatus, composer);
            const composerInput = composer.querySelector('input');
            let replyTarget = null;

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
                item.className = depth ? 'reply-item' : 'comment-item';
                const meta = document.createElement('strong');
                meta.textContent = comment.username || `User ${comment.user_id}`;
                const body = document.createElement('p');
                body.textContent = comment.content;
                const replyButton = document.createElement('button');
                replyButton.type = 'button';
                replyButton.className = 'comment-reply-btn';
                replyButton.textContent = 'Reply';
                item.append(meta, body, replyButton);
                replyButton.addEventListener('click', () => setReplyTarget(comment));
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
                if (!content) return;
                try {
                    await this.sendComment(post.id, content, replyTarget ? replyTarget.id : null);
                    composerInput.value = '';
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
        const goHome = async () => {
            if (!window.location.pathname.endsWith('/index.html') && window.location.pathname !== '/') {
                window.location.href = 'index.html';
                return;
            }
            homeButton?.classList.add('active');
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
            if (authOverlay) authOverlay.classList.add('hidden');
            mainApp.classList.remove('hidden');
            document.getElementById('nav-username').innerText = user.username || 'User';
            syncCurrentUserAvatars(user);
            this.renderFeed();
            if (sessionStorage.getItem('aero_profile_onboarding') === '1') {
                document.getElementById('profile-onboarding-overlay')?.classList.remove('hidden');
            }
        } else if (authOverlay) {
            authOverlay.classList.remove('hidden');
            if (mainApp) mainApp.classList.add('hidden');
        }
    },

    transitionToApp() {
        const authOverlay = document.getElementById('auth-overlay');
        const mainApp = document.getElementById('main-app');
        if (!authOverlay || !mainApp) return;

        const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
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

function closeAllPostMenus(exceptMenu = null) {
    document.querySelectorAll('.post-dropdown-menu, .post-menu').forEach(menu => {
        if (menu !== exceptMenu) {
            menu.classList.remove('show');
        }
    });
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
    document.getElementById('fab-new-post')?.addEventListener('click', openCreatePostModal);
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
    const fab = document.getElementById('fab-new-post');
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
                document.getElementById('signup-password').value
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