(() => {
    const views = {
        main: 'view-main',
        shorts: 'view-shorts',
        chat: 'view-chat',
        profile: 'profile-view'
    };
    let activeView = 'main';
    let activeProfileUserId = null;
    let isAuthenticated = Boolean(localStorage.getItem('aero_token'));

    function setActiveNavItem(view) {
        document.querySelectorAll('.dock-item').forEach((element) => element.classList.remove('active'));
        if (view === 'profile') return;
        const navId = view === 'main' ? 'home-nav-btn' : view === 'shorts' ? 'video-dock-btn' : 'chat-dock-btn';
        document.getElementById(navId)?.classList.add('active');
    }

    function cleanupShortsPlayback() {
        document.querySelectorAll('#view-shorts video').forEach((video) => {
            video.pause();
            video.currentTime = 0;
            video.muted = true;
            video.removeAttribute('src');
            video.load();
        });
        window.cleanupShortsPlayback?.();
    }

    function setFabAuthState(authenticated) {
        isAuthenticated = authenticated;
        if (!authenticated) {
            const fab = document.getElementById('global-fab-btn');
            fab?.classList.add('hidden');
            fab?.style.setProperty('display', 'none', 'important');
            return;
        }
        updateFab(activeView);
    }

    function updateFab(view) {
        const fab = document.getElementById('global-fab-btn');
        if (!fab) return;
        if (!isAuthenticated) {
            fab.classList.add('hidden');
            fab.style.setProperty('display', 'none', 'important');
            return;
        }
        fab.classList.remove('hidden');
        const isChat = view === 'chat';
        if (view === 'shorts') {
            fab.style.setProperty('display', 'flex', 'important');
        } else if (view === 'profile') {
            fab.style.setProperty('display', 'none', 'important');
        } else {
            fab.style.setProperty('display', isChat ? 'none' : 'flex', 'important');
        }
        fab.innerHTML = view === 'shorts'
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg><span class="fab-label">Video</span>'
            : '<i class="lucide-plus" aria-hidden="true"></i><span class="fab-label">New Post</span>';
        fab.setAttribute('aria-label', view === 'shorts' ? 'Upload Short Video' : 'Create a new post');
    }

    function setActiveFeedTab(type = 'for_you') {
        const forYouTab = document.getElementById('tab-for-you');
        const followingTab = document.getElementById('tab-following');
        const isFollowing = type === 'following';
        forYouTab?.classList.toggle('active', !isFollowing);
        followingTab?.classList.toggle('active', isFollowing);
    }

    async function loadPosts(feedType = 'for_you') {
        setActiveFeedTab(feedType);
        await window.AeroAPI?.renderFeed?.(feedType);
    }

    async function loadProfileView(userId = null) {
        const section = document.getElementById('profile-view');
        const container = document.getElementById('profile-posts-container');
        const header = document.getElementById('profile-header');
        if (!section || !container || !header) return;

        try {
            const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000/api' : `${window.location.origin}/api`;
            const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
            const currentUserId = Number(currentUser.id || currentUser.user_id || 0);
            const profileUserId = userId == null ? currentUserId : Number(userId);
            const response = await fetch(`${apiBase}/${profileUserId && profileUserId !== currentUserId ? `users/${profileUserId}` : 'users/me'}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Unable to load profile');

            const user = payload.user || {};
            let posts = Array.isArray(payload.posts) ? payload.posts : [];
            if (profileUserId && profileUserId !== currentUserId) {
                const postsResponse = await fetch(`${apiBase}/posts?author_id=${profileUserId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
                });
                const authorPosts = await postsResponse.json().catch(() => []);
                if (postsResponse.ok && Array.isArray(authorPosts)) posts = authorPosts;
            }
            const avatar = user.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${window.location.origin}${user.avatar_url}`) : '';
            const initials = (user.username || 'U').charAt(0).toUpperCase();
            const followText = (count) => count && Number(count) > 0 ? String(count) : '0';
            const isOwnProfile = profileUserId === currentUserId;

            header.innerHTML = `
                <div class="profile-header-main">
                    <div class="profile-header-copy">
                        <div class="profile-display-row">
                            <h2>${user.display_name || user.username || 'User'}</h2>
                        </div>
                        <div class="profile-handle">@${user.username || 'user'}</div>
                        <p class="profile-bio">${(user.bio || 'No bio yet.').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]))}</p>
                        ${isOwnProfile ? '<button type="button" class="profile-edit-btn">Edit Profile</button>' : `<div class="profile-action-group"><button id="profile-follow-btn" type="button" class="profile-follow-btn ${payload.is_following ? 'is-following' : ''}" data-user-id="${profileUserId}" data-following="${Boolean(payload.is_following)}">${payload.is_following ? 'Following' : 'Follow'}</button><button type="button" class="profile-message-btn" data-user-id="${profileUserId}">Message</button></div>`}
                        <div class="profile-stats">
                            <span><strong id="profile-followers-count">${followText(payload.followers_count)}</strong> Followers</span>
                            <span><strong>${followText(payload.following_count)}</strong> Following</span>
                        </div>
                    </div>
                    <div class="profile-avatar-wrap">
                        ${avatar ? `<img class="profile-avatar" src="${avatar}" alt="${(user.username || 'User').replace(/"/g, '&quot;')}" />` : `<span class="profile-avatar profile-avatar-empty">${initials}</span>`}
                    </div>
                </div>
            `;

            if (!isOwnProfile) {
                header.querySelector('.profile-follow-btn')?.addEventListener('click', async (event) => {
                    const button = event.currentTarget;
                    const following = button.dataset.following === 'true';
                    const count = header.querySelector('#profile-followers-count');
                    const previousCount = Number(count?.textContent || 0);
                    const nextFollowing = !following;
                    const updateFollowState = (isFollowing, followerCount) => {
                        button.textContent = isFollowing ? 'Following' : 'Follow';
                        button.classList.toggle('is-following', isFollowing);
                        button.classList.toggle('following', isFollowing);
                        button.dataset.following = String(isFollowing);
                        if (count) count.textContent = String(Math.max(0, followerCount));
                    };
                    updateFollowState(nextFollowing, previousCount + (nextFollowing ? 1 : -1));
                    button.disabled = true;
                    try {
                        const followApi = window.apiService || window.api || window.AeroAPI;
                        const result = followApi && typeof followApi.toggleFollow === 'function'
                            ? await followApi.toggleFollow(profileUserId, { username: user.username, avatar: user.avatar_url })
                            : await window.toggleFollowUser(profileUserId, { username: user.username, avatar: user.avatar_url });
                        updateFollowState(Boolean(result.is_following), result.followers_count ?? previousCount + (result.is_following ? 1 : -1));
                    } catch (error) {
                        updateFollowState(following, previousCount);
                        window.showNotice?.(error.message || 'Unable to update follow status', 'error');
                    } finally {
                        button.disabled = false;
                    }
                });
                header.querySelector('.profile-message-btn')?.addEventListener('click', () => {
                    window.switchView('chat');
                    window.loadChatContacts?.();
                    window.selectChatContact?.({ id: profileUserId, username: user.username, avatar_url: user.avatar_url });
                });
            }

            container.innerHTML = posts.length ? posts.map((post) => `
                <article class="post-card glass-card pop-in g2-card">
                    <div class="post-header">
                        <div class="post-author-identity">
                            <img class="post-avatar" src="${avatar}" alt="@${(user.username || 'User').replace(/"/g, '&quot;')}" />
                            <span class="post-author">@${user.username || 'user'}</span>
                            <time class="post-relative-time">${new Date(post.created_at || Date.now()).toLocaleDateString()}</time>
                        </div>
                    </div>
                    <div class="post-content">${(post.content || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]))}</div>
                </article>
            `).join('') : '<div class="post-card glass-card text-center"><p>No posts yet.</p></div>';
            bindProfileTabs(profileUserId, user, avatar);
        } catch (error) {
            header.innerHTML = `
                <div class="profile-header-main">
                    <div class="profile-header-copy">
                        <div class="profile-display-row"><h2>Profile</h2></div>
                        <div class="profile-handle">@user</div>
                        <p class="profile-bio">${error.message}</p>
                    </div>
                </div>
            `;
            container.innerHTML = '<div class="post-card glass-card text-center"><p>Unable to load profile.</p></div>';
        }
    }

    async function loadProfileContent(userId, contentType, user, avatar) {
        const container = document.getElementById('profile-posts-container');
        if (!container) return;
        container.innerHTML = '<div class="profile-loading" aria-live="polite">Loading...</div>';
        const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000/api' : `${window.location.origin}/api`;
        try {
            const response = await fetch(`${apiBase}/users/${userId}/content?type=${encodeURIComponent(contentType)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Unable to load profile content');
            const items = Array.isArray(payload.items) ? payload.items : [];
            const escape = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
            if (!items.length) {
                container.innerHTML = `<div class="post-card glass-card text-center"><p>No ${contentType} yet.</p></div>`;
                return;
            }
            if (contentType === 'shorts') {
                container.innerHTML = `<div class="profile-shorts-grid">${items.map((item) => `<article class="profile-short-card"><video src="${escape(item.video_url)}" muted playsinline preload="metadata"></video><strong>${escape(item.caption || 'Untitled Short')}</strong><small>${Number(item.views_count || 0)} views</small></article>`).join('')}</div>`;
                return;
            }
            container.innerHTML = items.map((item) => {
                const content = contentType === 'replies' ? item.content : item.content;
                const summary = contentType === 'replies' ? `<small class="profile-content-context">On @${escape(item.post?.username)}: ${escape(item.post?.content)}</small>` : '';
                return `<article class="post-card glass-card pop-in g2-card"><div class="post-header"><div class="post-author-identity"><img class="post-avatar" src="${escape(avatar)}" alt="@${escape(user.username)}"><span class="post-author">@${escape(user.username)}</span><time class="post-relative-time">${new Date(item.created_at || Date.now()).toLocaleDateString()}</time></div></div><div class="post-content">${escape(content)}</div>${summary}</article>`;
            }).join('');
        } catch (error) {
            container.innerHTML = `<div class="post-card glass-card text-center"><p>${error.message}</p></div>`;
        }
    }

    function bindProfileTabs(userId, user, avatar) {
        document.querySelectorAll('[data-profile-tab]').forEach((tab) => {
            tab.onclick = () => {
                document.querySelectorAll('[data-profile-tab]').forEach((item) => item.classList.toggle('active', item === tab));
                loadProfileContent(userId, tab.dataset.profileTab || 'posts', user, avatar);
            };
        });
    }

    function switchView(view, options = {}) {
        if (!views[view]) return;
        if (activeView === 'shorts' && view !== 'shorts') cleanupShortsPlayback();
        activeView = view;
        const currentViewId = views[view];
        document.querySelectorAll('.view-container, .view-section, #search-results-page').forEach((element) => {
            element.classList.toggle('hidden', element.id !== currentViewId);
        });
        Object.entries(views).forEach(([name, id]) => {
            document.getElementById(id)?.classList.toggle('hidden', name !== view);
        });
        setActiveNavItem(view);
        document.getElementById('view-chat')?.classList.toggle('hidden', view !== 'chat');
        updateFab(view);
        if (view === 'profile') {
            activeProfileUserId = options.userId == null ? null : Number(options.userId);
            loadProfileView(activeProfileUserId);
        }
        window.dispatchEvent(new CustomEvent('aero:view-change', { detail: { view } }));
    }

    function navigate(view) {
        switchView(view);
    }

    function navigateToUserProfile(userId) {
        if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) return;
        switchView('profile', { userId: Number(userId) });
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.addEventListener('click', (event) => {
            const dockButton = event.target.closest('#home-nav-btn, #video-dock-btn, #chat-dock-btn');
            if (dockButton) {
                const view = dockButton.id === 'home-nav-btn' ? 'main' : dockButton.id === 'video-dock-btn' ? 'shorts' : 'chat';
                navigate(view);
                return;
            }
            const profileButton = event.target.closest('#user-avatar-btn');
            if (profileButton) {
                switchView('profile');
                return;
            }
            const feedTab = event.target.closest('#tab-for-you, #tab-following');
            if (feedTab) {
                const feedType = feedTab.id === 'tab-following' ? 'following' : 'for_you';
                loadPosts(feedType);
                return;
            }
            const fab = event.target.closest('#global-fab-btn');
            if (fab && activeView === 'shorts') {
                event.preventDefault();
                event.stopImmediatePropagation();
                window.openVideoUploadModal?.();
            }
        }, true);
        document.getElementById('user-avatar-btn')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                switchView('profile');
            }
        });
        document.getElementById('tab-for-you')?.addEventListener('click', () => loadPosts('for_you'));
        document.getElementById('tab-following')?.addEventListener('click', () => loadPosts('following'));
        navigate('main');
        setActiveFeedTab('for_you');
        setFabAuthState(Boolean(localStorage.getItem('aero_token')));
    });

    window.setFabAuthState = setFabAuthState;
    window.setActiveNavItem = setActiveNavItem;
    window.switchView = switchView;
    window.navigateToUserProfile = navigateToUserProfile;
    window.AeroRouter = { navigate, switchView, get activeView() { return activeView; } };
})();
