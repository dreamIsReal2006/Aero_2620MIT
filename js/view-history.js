(() => {
    const STORAGE_KEY = 'aero_view_history';
    const HISTORY_LIMIT = 20;

    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[character]));

    function readHistory() {
        try {
            const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(history) ? history : [];
        } catch {
            return [];
        }
    }

    function relativeTime(value) {
        const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
        const seconds = Math.floor(elapsed / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    function avatarMarkup(post) {
        const username = post.username || 'User';
        const avatarUrl = String(post.avatar_url || '');
        if (avatarUrl) {
            const normalizedUrl = avatarUrl.startsWith('http') ? avatarUrl : `${window.location.origin}${avatarUrl}`;
            return `<img src="${escapeHtml(normalizedUrl)}" alt="@${escapeHtml(username)}" onerror="this.outerHTML='<span>${escapeHtml(username.charAt(0).toUpperCase())}</span>'">`;
        }
        return `<span>${escapeHtml(username.charAt(0).toUpperCase() || 'U')}</span>`;
    }

    function setDrawerOpen(isOpen) {
        document.getElementById('history-drawer')?.classList.toggle('hidden', !isOpen);
        document.getElementById('history-dock-btn')?.classList.toggle('active', isOpen);
    }

    function openHistoryPost(postId) {
        setDrawerOpen(false);
        window.AeroRouter?.navigate('main');
        const findPost = () => document.querySelector(`#posts-feed [data-post-id="${CSS.escape(String(postId))}"]`);
        const scrollToPost = () => findPost()?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (findPost()) {
            scrollToPost();
            return;
        }
        window.AeroAPI?.renderFeed?.().then(scrollToPost).catch(() => {});
    }

    function render() {
        const list = document.getElementById('history-list');
        if (!list) return;
        const history = readHistory();
        list.innerHTML = history.length ? history.map((post) => `
            <article class="history-item bookmark-item" data-history-id="${Number(post.id)}" tabindex="0" role="button" aria-label="Open post by @${escapeHtml(post.username || 'User')}">
                <span class="bookmark-item-avatar" aria-hidden="true">${avatarMarkup(post)}</span>
                <div class="bookmark-item-content">
                    <div class="bookmark-item-header"><span class="bookmark-item-author">@${escapeHtml(post.username || 'User')}</span><span class="bookmark-item-time">${relativeTime(post.viewed_at)}</span></div>
                    <p class="bookmark-item-text">${escapeHtml(post.content || 'Viewed post')}</p>
                </div>
            </article>
        `).join('') : '<div class="bookmarks-empty"><div class="bookmarks-empty-icon">H</div><div>No viewed posts yet.</div></div>';

        list.querySelectorAll('.history-item').forEach((item) => {
            const open = () => openHistoryPost(item.dataset.historyId);
            item.addEventListener('click', open);
            item.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open();
                }
            });
        });
    }

    function recordViewedPost(post) {
        const id = Number(post?.id);
        if (!Number.isInteger(id) || id <= 0) return;
        const entry = {
            id,
            username: post.username || 'User',
            avatar_url: post.avatar_url || '',
            content: post.content || '',
            viewed_at: new Date().toISOString()
        };
        const history = [entry, ...readHistory().filter((item) => Number(item.id) !== id)].slice(0, HISTORY_LIMIT);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        if (!document.getElementById('history-drawer')?.classList.contains('hidden')) render();
    }

    function setup() {
        const button = document.getElementById('history-dock-btn');
        button?.addEventListener('click', () => {
            const opening = document.getElementById('history-drawer')?.classList.contains('hidden');
            setDrawerOpen(Boolean(opening));
            if (opening) render();
        });
        document.getElementById('close-history-drawer')?.addEventListener('click', () => setDrawerOpen(false));
        document.getElementById('clear-history-btn')?.addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEY);
            render();
        });
        render();
    }

    window.ViewHistory = { recordViewedPost };
    document.addEventListener('DOMContentLoaded', setup);
})();
