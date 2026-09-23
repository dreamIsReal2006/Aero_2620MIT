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

    const profileApiBase = () => window.AeroConfig.API_BASE_URL;

    function profileAvatarValue(user = {}) {
        const value = String(user.avatar_url || '');
        if (value.startsWith('letter:')) return { letter: value.slice(7, 8).toUpperCase() || 'U' };
        return { url: value ? (value.startsWith('http') ? value : `${window.AeroConfig.API_ORIGIN}${value}`) : '', letter: String(user.display_name || user.username || 'U').charAt(0).toUpperCase() };
    }

    function profileRoleBadge(role) {
        const normalized = ['admin', 'moderator'].includes(role) ? role : '';
        if (!normalized || (window.shouldShowBadge && !window.shouldShowBadge(normalized))) return '';
        const icon = normalized === 'admin'
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"></path><path d="m9 12 2 2 4-4"></path></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"></path><path d="M8 12h8M12 8v8"></path></svg>';
        return `<span class="role-badge ${normalized}">${icon}<span>${normalized}</span></span>`;
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
                image.loading = 'lazy';
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
            image.src = stringValue.startsWith('http') ? stringValue : `${window.AeroConfig.API_ORIGIN}${stringValue}`;
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

    function checkNFCSupport() {
        const isMobile = window.innerWidth <= 768 || /Android|iPhone/i.test(navigator.userAgent);
        return isMobile && 'NDEFReader' in window;
    }

    function profileShareUrl(userId) {
        const username = typeof userId === 'object' ? userId.username : userId;
        return `${window.location.origin}${window.location.pathname}?user=${encodeURIComponent(username)}`;
    }

    function setNfcStatus(message, active = false) {
        const status = document.getElementById('nfc-share-status');
        if (status) status.textContent = message;
        document.getElementById('nfc-share-panel')?.classList.toggle('is-active', active);
    }

    async function startNFCShare(profileUrl) {
        const fallbackToClipboard = async () => {
            try {
                await navigator.clipboard.writeText(profileUrl);
                setNfcStatus('NFC is unavailable. Profile link copied to clipboard.');
                window.showNotice?.('NFC 写入不可用，已自动复制 Profile 链接至剪贴板', 'info');
            } catch (clipboardError) {
                setNfcStatus('NFC is unavailable. Use the QR code or copy the link.');
                window.showNotice?.('NFC writing is unavailable. Please copy the Profile link manually.', 'info');
            }
        };
        if (!checkNFCSupport()) {
            await fallbackToClipboard();
            return;
        }
        setNfcStatus('Ready. Hold another phone close to this one.', true);
        try {
            const ndef = new NDEFReader();
            await ndef.write({ records: [{ recordType: 'url', data: profileUrl }] });
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            setNfcStatus('NFC link written successfully.');
            window.showNotice?.('NFC sharing is ready. Bring the phones together.', 'success');
        } catch (error) {
            console.error('NFC Write Error:', error);
            await fallbackToClipboard();
        } finally {
            document.getElementById('nfc-share-panel')?.classList.remove('is-active');
        }
    }

    function openProfileShareModal(user, userId) {
        const modal = document.getElementById('share-profile-modal');
        const profileUrl = profileShareUrl(user);
        if (!modal) return;
        document.getElementById('share-profile-name').textContent = user.display_name || user.username || 'Profile';
        document.getElementById('share-profile-handle').textContent = `@${user.username || 'user'}`;
        document.getElementById('share-profile-qr').src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(profileUrl)}`;
        document.getElementById('copy-profile-link').dataset.profileUrl = profileUrl;
        document.getElementById('start-nfc-share').dataset.profileUrl = profileUrl;
        setNfcStatus(checkNFCSupport() ? 'Ready to share with a nearby phone.' : 'Use the QR code or copy the link on this device.');
        modal.classList.remove('hidden');
    }

    function closeProfileShareModal() {
        document.getElementById('share-profile-modal')?.classList.add('hidden');
        document.getElementById('nfc-share-panel')?.classList.remove('is-active');
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
                formData.append('folder', 'profile');
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
        if (window.innerWidth <= 768) {
            fab.classList.add('hidden');
            fab.style.setProperty('display', 'none', 'important');
            return;
        }
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
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg><span class="fab-label" data-i18n="common.new_video">Video</span>'
            : '<i class="lucide-plus" aria-hidden="true"></i><span class="fab-label" data-i18n="common.new_post">New Post</span>';
        fab.setAttribute('aria-label', view === 'shorts' ? 'Upload Short Video' : 'Create a new post');
    }

    function syncFabForViewport() {
        updateFab(activeView);
    }

    function setupScrollPerformance() {
        let scrollResetTimer = 0;
        const markScrolling = () => {
            document.body.classList.add('is-scrolling');
            window.clearTimeout(scrollResetTimer);
            scrollResetTimer = window.setTimeout(() => document.body.classList.remove('is-scrolling'), 150);
        };
        window.addEventListener('scroll', markScrolling, { passive: true });
        document.querySelectorAll('.chat-messages, .shorts-stage, .short-comments-list').forEach((container) => {
            container.addEventListener('scroll', markScrolling, { passive: true });
        });
    }

    function setActiveFeedTab(type = 'for_you') {
        const forYouTab = document.getElementById('tab-for-you');
        const followingTab = document.getElementById('tab-following');
        const isFollowing = type === 'following';
        forYouTab?.classList.toggle('active', !isFollowing);
        followingTab?.classList.toggle('active', isFollowing);
        requestAnimationFrame(updateTabIndicator);
    }

    function updateTabIndicator() {
        const container = document.querySelector('.feed-tabs');
        const activeTab = container?.querySelector('.feed-tab.active');
        const indicator = container?.querySelector('.tab-indicator');
        if (!container || !activeTab || !indicator) return;
        indicator.style.width = `${activeTab.offsetWidth}px`;
        indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
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
            const apiBase = window.AeroConfig.API_BASE_URL;
            const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
            const currentUserId = Number(currentUser.id || currentUser.user_id || 0);
            const queryParams = new URLSearchParams(window.location.search);
            const sharedUsername = (queryParams.get('user') || queryParams.get('profile') || '').trim();
            let profileUserId = userId == null ? currentUserId : Number(userId);
            if (sharedUsername && !/^\d+$/.test(sharedUsername)) {
                const profileResponse = await fetch(`${apiBase}/users/profile?username=${encodeURIComponent(sharedUsername)}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
                });
                const profilePayload = await profileResponse.json().catch(() => ({}));
                if (!profileResponse.ok || !profilePayload.user?.id) throw new Error(profilePayload.message || 'Profile not found');
                profileUserId = Number(profilePayload.user.id);
            } else if (sharedUsername) {
                profileUserId = Number(sharedUsername);
            }
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
                            <h2>${user.display_name || user.username || 'User'}${profileRoleBadge(user.role)}</h2>
                            ${isOwnProfile ? '<button type="button" class="profile-share-btn" id="profile-share-btn" aria-label="Share profile" title="Share profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"></path></svg></button>' : ''}
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

            header.querySelector('#profile-share-btn')?.addEventListener('click', () => {
                if (isOwnProfile) openProfileShareModal(user, profileUserId);
            });
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
                <article class="post-card glass-card liquid-glass liquid-glass-interactive pop-in g2-card">
                    <div class="post-header">
                        <div class="post-author-identity">
                            <span class="post-avatar ${user.is_online ? 'is-online' : ''}"><img src="${avatar}" alt="@${(user.username || 'User').replace(/"/g, '&quot;')}" /></span>
                            <span class="post-author">@${user.username || 'user'}${profileRoleBadge(user.role)}</span>
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
        const apiBase = window.AeroConfig.API_BASE_URL;
        try {
            const response = await fetch(`${apiBase}/users/${userId}/content?type=${encodeURIComponent(contentType)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` }
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Unable to load profile content');
            const items = Array.isArray(payload.items) ? payload.items : [];
            const escape = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
            if (!items.length) {
                container.innerHTML = `<div class="post-card glass-card liquid-glass text-center"><p>No ${contentType} yet.</p></div>`;
                return;
            }
            if (contentType === 'shorts') {
                container.innerHTML = `<div class="profile-shorts-grid">${items.map((item) => `<article class="profile-short-card"><video src="${escape(item.video_url)}" muted playsinline preload="metadata"></video><strong>${escape(item.caption || 'Untitled Short')}</strong><small>${Number(item.views_count || 0)} views</small></article>`).join('')}</div>`;
                return;
            }
            container.innerHTML = items.map((item) => {
                const content = contentType === 'replies' ? item.content : item.content;
                const summary = contentType === 'replies' ? `<small class="profile-content-context">On @${escape(item.post?.username)}: ${escape(item.post?.content)}</small>` : '';
                return `<article class="post-card glass-card liquid-glass liquid-glass-interactive pop-in g2-card"><div class="post-header"><div class="post-author-identity"><span class="post-avatar ${user.is_online ? 'is-online' : ''}"><img src="${escape(avatar)}" alt="@${escape(user.username)}"></span><span class="post-author">@${escape(user.username)}${profileRoleBadge(user.role)}</span><time class="post-relative-time">${window.AeroFormatRelativeTime?.(item.created_at) || new Date(item.created_at || Date.now()).toLocaleDateString()}</time></div></div><div class="post-content">${escape(content)}</div>${summary}</article>`;
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
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
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

    function navigate(view, options = {}) {
        switchView(view, options);
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
        document.getElementById('close-share-profile')?.addEventListener('click', closeProfileShareModal);
        document.getElementById('share-profile-modal')?.addEventListener('click', (event) => {
            if (event.target.id === 'share-profile-modal') closeProfileShareModal();
        });
        document.getElementById('copy-profile-link')?.addEventListener('click', async (event) => {
            const url = event.currentTarget.dataset.profileUrl;
            try {
                await navigator.clipboard.writeText(url);
                window.showNotice?.('Profile link copied.', 'success');
            } catch (error) {
                window.showNotice?.('Unable to copy the profile link.', 'error');
            }
        });
        document.getElementById('start-nfc-share')?.addEventListener('click', (event) => startNFCShare(event.currentTarget.dataset.profileUrl));
        document.addEventListener('click', (event) => {
            const adminLink = event.target.closest('#admin-dashboard-link');
            if (adminLink) {
                event.preventDefault();
                const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
                const route = user.is_admin === true || user.role === 'admin' ? 'admin' : 'moderator';
                window.location.href = `admin.html#${route}`;
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
        const routeParams = new URLSearchParams(window.location.search);
        const sharedProfile = (routeParams.get('user') || routeParams.get('profile') || '').trim();
        const legacyProfile = window.location.hash.match(/^#profile\/(\d+)$/);
        if (sharedProfile) navigate('profile', { userId: /^\d+$/.test(sharedProfile) ? Number(sharedProfile) : sharedProfile });
        else if (legacyProfile) navigate('profile', { userId: Number(legacyProfile[1]) });
        else navigate('main');
        setActiveFeedTab('for_you');
        setFabAuthState(Boolean(localStorage.getItem('aero_token')));
        setupScrollPerformance();
        window.addEventListener('resize', syncFabForViewport, { passive: true });
        window.addEventListener('resize', updateTabIndicator, { passive: true });
        updateTabIndicator();
    });

    window.setFabAuthState = setFabAuthState;
    window.setActiveNavItem = setActiveNavItem;
    window.switchView = switchView;
    window.navigateToUserProfile = navigateToUserProfile;
    window.AeroRouter = { navigate, switchView, get activeView() { return activeView; } };
    window.checkNFCSupport = checkNFCSupport;
    window.startNFCShare = startNFCShare;
})();
