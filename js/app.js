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
    let profileEditorUser = null;
    let profileEditorFile = null;

    const profileApiBase = () => window.location.protocol === 'file:'
        ? 'http://127.0.0.1:5000/api'
        : `${window.location.origin}/api`;

    function profileAvatarValue(user = {}) {
        const value = String(user.avatar_url || '');
        if (value.startsWith('letter:')) return { letter: value.slice(7, 8).toUpperCase() || 'U' };
        return { url: value ? (value.startsWith('http') ? value : `${window.location.origin}${value}`) : '', letter: String(user.display_name || user.username || 'U').charAt(0).toUpperCase() };
    }

    function updateSharedUserState(user) {
        const previous = JSON.parse(localStorage.getItem('aero_user') || '{}');
        const nextUser = { ...previous, ...user };
        localStorage.setItem('aero_user', JSON.stringify(nextUser));
        const name = document.getElementById('nav-username');
        if (name) name.textContent = nextUser.display_name || nextUser.username || 'User';
        const avatar = document.getElementById('nav-avatar');
        if (avatar) {
            const avatarValue = profileAvatarValue(nextUser);
            avatar.replaceChildren();
            if (avatarValue.url) {
                const image = document.createElement('img');
                image.src = avatarValue.url;
                image.alt = '';
                avatar.appendChild(image);
            } else avatar.textContent = avatarValue.letter;
        }
        window.dispatchEvent(new CustomEvent('aero:user-updated', { detail: nextUser }));
        return nextUser;
    }

    function setProfileEditorPreview(value, fallback = 'U') {
        const preview = document.getElementById('profile-edit-avatar-preview');
        if (!preview) return;
        preview.replaceChildren();
        if (value instanceof File) {
            const image = document.createElement('img');
            image.src = URL.createObjectURL(value);
            image.onload = () => URL.revokeObjectURL(image.src);
            preview.appendChild(image);
            return;
        }
        const stringValue = String(value || '');
        if (stringValue && !stringValue.startsWith('letter:') && /^(https?:\/\/|\/)/i.test(stringValue)) {
            const image = document.createElement('img');
            image.src = stringValue.startsWith('http') ? stringValue : `${window.location.origin}${stringValue}`;
            image.alt = '';
            image.onerror = () => { preview.replaceChildren(); preview.textContent = fallback; };
            preview.appendChild(image);
        } else {
            preview.textContent = (stringValue.replace(/^letter:/, '').charAt(0) || fallback).toUpperCase();
        }
    }

    function openProfileEditor(user) {
        profileEditorUser = { ...user };
        profileEditorFile = null;
        const modal = document.getElementById('profile-edit-modal');
        const avatar = profileAvatarValue(profileEditorUser);
        document.getElementById('profile-edit-display-name').value = profileEditorUser.display_name || profileEditorUser.username || '';
        document.getElementById('profile-edit-username').value = profileEditorUser.username || '';
        document.getElementById('profile-edit-bio').value = profileEditorUser.bio || '';
        document.getElementById('profile-edit-avatar').value = avatar.url || (avatar.letter ? `letter:${avatar.letter}` : '');
        document.getElementById('profile-edit-avatar-file').value = '';
        document.getElementById('profile-edit-feedback').textContent = '';
        setProfileEditorPreview(profileEditorUser.avatar_url, avatar.letter || 'U');
        modal?.classList.remove('hidden');
        document.getElementById('profile-edit-display-name')?.focus();
    }

    function closeProfileEditor() {
        document.getElementById('profile-edit-modal')?.classList.add('hidden');
        profileEditorUser = null;
        profileEditorFile = null;
    }

    async function saveProfileEditor(event) {
        event.preventDefault();
        const saveButton = document.getElementById('save-profile-edit');
        const feedback = document.getElementById('profile-edit-feedback');
        const username = document.getElementById('profile-edit-username').value.trim();
        const displayName = document.getElementById('profile-edit-display-name').value.trim();
        const bio = document.getElementById('profile-edit-bio').value.trim();
        let avatarUrl = document.getElementById('profile-edit-avatar').value.trim();
        if (!username || !displayName) { feedback.textContent = 'Display name and handle are required.'; return; }
        saveButton.disabled = true;
        feedback.textContent = '';
        try {
            if (profileEditorFile) {
                const formData = new FormData();
                formData.append('file', profileEditorFile);
                const uploadResponse = await fetch(`${profileApiBase()}/uploads`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }, body: formData });
                const uploadData = await uploadResponse.json().catch(() => ({}));
                if (!uploadResponse.ok) throw new Error(uploadData.message || 'Unable to upload avatar');
                avatarUrl = uploadData.url;
            } else if (/^[A-Za-z]$/.test(avatarUrl)) {
                avatarUrl = `letter:${avatarUrl.toUpperCase()}`;
            }
            const updated = await window.AeroAPI.updateProfile({ username, display_name: displayName, bio, avatar_url: avatarUrl });
            const nextUser = updateSharedUserState(updated);
            closeProfileEditor();
            await loadProfileView(nextUser.id);
            window.showNotice?.('Profile updated successfully.', 'success');
        } catch (error) {
            feedback.textContent = error.message || 'Unable to update profile.';
        } finally {
            saveButton.disabled = false;
        }
    }

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
            const avatarValue = profileAvatarValue(user);
            const avatar = avatarValue.url;
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
                    <div class="profile-avatar-wrap ${user.is_online ? 'is-online' : ''}">
                        ${avatar ? `<img class="profile-avatar" src="${avatar}" alt="${(user.username || 'User').replace(/"/g, '&quot;')}" />` : `<span class="profile-avatar profile-avatar-empty">${avatarValue.letter || initials}</span>`}
                    </div>
                </div>
            `;

            header.querySelector('.profile-edit-btn')?.addEventListener('click', () => openProfileEditor(user));

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
                    window.selectChatContact?.({ id: profileUserId, username: user.username, avatar_url: user.avatar_url, is_online: user.is_online });
                });
            }

            container.innerHTML = posts.length ? posts.map((post) => `
                <article class="post-card glass-card pop-in g2-card">
                    <div class="post-header">
                        <div class="post-author-identity">
                            <span class="post-avatar ${user.is_online ? 'is-online' : ''}"><img src="${avatar}" alt="@${(user.username || 'User').replace(/"/g, '&quot;')}" /></span>
                            <span class="post-author">@${user.username || 'user'}</span>
                            <time class="post-relative-time">${window.AeroFormatRelativeTime?.(post.created_at) || new Date(post.created_at || Date.now()).toLocaleDateString()}</time>
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
                return `<article class="post-card glass-card pop-in g2-card"><div class="post-header"><div class="post-author-identity"><span class="post-avatar ${user.is_online ? 'is-online' : ''}"><img src="${escape(avatar)}" alt="@${escape(user.username)}"></span><span class="post-author">@${escape(user.username)}</span><time class="post-relative-time">${window.AeroFormatRelativeTime?.(item.created_at) || new Date(item.created_at || Date.now()).toLocaleDateString()}</time></div></div><div class="post-content">${escape(content)}</div>${summary}</article>`;
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
        document.getElementById('profile-edit-form')?.addEventListener('submit', saveProfileEditor);
        document.getElementById('close-profile-edit')?.addEventListener('click', closeProfileEditor);
        document.getElementById('cancel-profile-edit')?.addEventListener('click', closeProfileEditor);
        document.getElementById('profile-edit-modal')?.addEventListener('click', (event) => {
            if (event.target.id === 'profile-edit-modal') closeProfileEditor();
        });
        document.getElementById('profile-edit-avatar-file')?.addEventListener('change', (event) => {
            profileEditorFile = event.target.files?.[0] || null;
            if (profileEditorFile) setProfileEditorPreview(profileEditorFile);
        });
        document.getElementById('profile-edit-avatar')?.addEventListener('input', (event) => {
            if (!profileEditorFile) setProfileEditorPreview(event.target.value, String(document.getElementById('profile-edit-display-name')?.value || 'U').charAt(0).toUpperCase());
        });
        document.addEventListener('click', (event) => {
            const adminLink = event.target.closest('#admin-dashboard-link');
            if (adminLink) {
                event.preventDefault();
                const apiBase = window.location.protocol === 'file:'
                    ? 'http://127.0.0.1:5000/api'
                    : `${window.location.origin}/api`;
                fetch(`${apiBase}/admin-entry`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
                }).then(async (response) => {
                    const data = await response.json().catch(() => ({}));
                    if (!response.ok || !data.url) throw new Error(data.message || 'Unable to open Admin Dashboard');
                    window.location.href = data.url;
                }).catch((error) => window.showNotice?.(error.message, 'error'));
                return;
            }
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
