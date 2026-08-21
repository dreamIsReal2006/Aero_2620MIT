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
                window.location.href = 'index.html';
            } else {
                showNotice(data.message || 'OTP verification failed', 'error');
            }
        } catch (err) {
            console.error('API Error:', err);
            showNotice('Unable to connect to Aero right now.', 'error');
        }
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
            return await res.json();
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
        if (!res.ok) throw new Error(data.message || 'Image upload failed');
        return `${API_ORIGIN}${data.url}`;
    },

    async deletePost(postId) {
        await fetch(`${API_BASE}/posts/${postId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
        });
        this.renderFeed();
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
            const header = document.createElement('div');
            header.className = 'post-header';
            const author = document.createElement('span');
            author.className = 'post-author';
            author.textContent = `User ${post.username}`;
            header.appendChild(author);
            if (post.username === currentUser.username) {
                const deleteButton = document.createElement('button');
                deleteButton.className = 'icon-btn';
                deleteButton.type = 'button';
                deleteButton.setAttribute('aria-label', 'Delete post');
                deleteButton.title = 'Delete post';
                deleteButton.appendChild(createIcon('<path d="M5 7h14M10 11v5M14 11v5M9 7V4h6v3m-9 0 1 13h10l1-13"></path>', 'Delete post'));
                deleteButton.addEventListener('click', () => this.deletePost(post.id));
                header.appendChild(deleteButton);
            }
            const content = document.createElement('div');
            content.className = 'post-content';
            content.textContent = post.content;
            postEl.append(header, content);
            if (post.images && post.images.length) {
                const media = document.createElement('div');
                media.className = 'post-media-grid';
                post.images.slice(0, 3).forEach(imageUrl => {
                    const image = document.createElement('img');
                    image.src = imageUrl;
                    image.alt = 'Post media';
                    image.loading = 'lazy';
                    media.appendChild(image);
                });
                postEl.appendChild(media);
            }
            const actions = document.createElement('div');
            actions.className = 'post-actions';
            const likeButton = document.createElement('button');
            likeButton.className = 'post-action-btn';
            likeButton.type = 'button';
            likeButton.setAttribute('aria-label', 'Like post');
            likeButton.title = 'Like post';
            likeButton.appendChild(createIcon('<path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"></path>', 'Like post'));
            likeButton.append(` ${post.likes || 0}`);
            const commentButton = document.createElement('button');
            commentButton.className = 'post-action-btn';
            commentButton.type = 'button';
            commentButton.setAttribute('aria-label', 'Comment on post');
            commentButton.title = 'Comment on post';
            commentButton.appendChild(createIcon('<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.5-.7L4 20l1.7-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"></path>', 'Comment on post'));
            commentButton.append(` ${post.comments || 0}`);
            actions.append(likeButton, commentButton);
            postEl.appendChild(actions);
            feedContainer.appendChild(postEl);
        });
    },

    initAppState() {
        const token = localStorage.getItem('aero_token');
        const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
        
        const authOverlay = document.getElementById('auth-overlay');
        const mainApp = document.getElementById('main-app');

        if (token && mainApp) {
            if (authOverlay) authOverlay.classList.add('hidden');
            mainApp.classList.remove('hidden');
            document.getElementById('nav-username').innerText = user.username || 'User';
            this.renderFeed();
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
        authOverlay.classList.remove('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('app-entering');
        authOverlay.classList.add('is-exiting');
        document.getElementById('nav-username').textContent = user.username || 'User';
        this.renderFeed();

        window.setTimeout(() => {
            authOverlay.classList.add('hidden');
            authOverlay.classList.remove('is-exiting');
            mainApp.classList.remove('app-entering');
        }, 460);
    }
};



// Page event handlers
document.addEventListener('DOMContentLoaded', () => {
    AeroAPI.initAppState();
    setupSearchInteraction();
    setupSearchPage();

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
        signupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            AeroAPI.signup(
                document.getElementById('signup-username').value,
                document.getElementById('signup-email').value,
                document.getElementById('signup-password').value
            );
        });
    }

    // Post submission
    const publishBtn = document.getElementById('publish-post-btn');
    if (publishBtn) {
        publishBtn.addEventListener('click', async () => {
            const input = document.getElementById('post-input');
            const imageInput = document.getElementById('post-images');
            if (input.value.trim() || imageInput.files.length) {
                publishBtn.disabled = true;
                try {
                    const imageUrls = await Promise.all(Array.from(imageInput.files).slice(0, 10).map(file => AeroAPI.uploadMedia(file)));
                    await AeroAPI.createPost(input.value, imageUrls);
                } catch (error) {
                    showNotice(error.message, 'error');
                } finally {
                    publishBtn.disabled = false;
                }
                input.value = '';
                imageInput.value = '';
                AeroAPI.renderFeed();
            }
        });
    }

    // Sign out
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            location.reload();
        });
    }
});