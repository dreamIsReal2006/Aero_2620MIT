// Main legacy page controller and feed view state
// From: index.html events -> To: /api/posts and browser-rendered feed views
(() => {
    const views = {
        main: 'view-main',
        shorts: 'view-shorts',
        chat: 'view-chat',
        profile: 'profile-view',
        post: 'post-detail-view'
    };
    let activeView = 'main';
    let activeProfileUserId = null;
    let postDetailReturn = { view: 'main', userId: null };
    let postDetailRequestId = 0;
    let postDetailHistoryEntry = false;
    let isAuthenticated = Boolean(localStorage.getItem('aero_token'));
    let profileEditorUser = null;
    let profileEditorFile = null;
    let followsModalState = null;

    const profileApiBase = () => window.AeroConfig.API_BASE_URL;

    function profileAvatarValue(user = {}) {
        const value = String(user.avatar_url || '');
        const letter = (value.startsWith('letter:') ? value.slice(7, 8) : String(user.username || user.display_name || 'U').slice(0, 1)).toUpperCase() || 'U';
        const identity = String(user.username || user.display_name || letter).toLowerCase();
        const colors = ['#0A84FF', '#16A085', '#D35400', '#C0392B', '#7D3C98', '#2874A6'];
        let hash = 0;
        for (const character of identity) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${colors[hash % colors.length]}"/><text x="50" y="52" dominant-baseline="central" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="48" font-weight="700">${letter}</text></svg>`;
        const fallbackUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        if (!value || value.startsWith('letter:')) return { url: fallbackUrl, fallbackUrl, letter };
        return { url: value.startsWith('http') ? value : `${window.AeroConfig.API_ORIGIN}${value}`, fallbackUrl, letter };
    }

    function profileRoleBadge(role) {
        const normalized = ['admin', 'moderator'].includes(role) ? role : '';
        if (!normalized || (window.shouldShowBadge && !window.shouldShowBadge(normalized))) return '';
        const icon = normalized === 'admin'
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"></path><path d="m9 12 2 2 4-4"></path></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"></path><path d="M8 12h8M12 8v8"></path></svg>';
        const label = window.AeroI18n?.t(`role_${normalized}`) || normalized;
        return `<span class="role-badge ${normalized}">${icon}<span>${label}</span></span>`;
    }

    function profileEscape(value) {
        return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    }

    function followsText(value) {
        return window.AeroI18n?.translateValue(value) || value;
    }

    function ensureFollowsModal() {
        let overlay = document.getElementById('profile-follows-modal');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'profile-follows-modal';
        overlay.className = 'profile-follows-modal-overlay hidden';
        overlay.setAttribute('role', 'presentation');
        overlay.innerHTML = `<section class="profile-follows-modal" role="dialog" aria-modal="true" aria-label="Followers and Following"><header class="profile-follows-header"><div class="profile-follows-tabs" role="tablist"><button type="button" data-follows-tab="followers" role="tab"></button><button type="button" data-follows-tab="following" role="tab"></button><span class="profile-follows-indicator"></span></div><button type="button" class="profile-follows-close" aria-label="Close">&times;</button></header><div class="profile-follows-list" role="tabpanel" aria-live="polite"></div></section>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (event) => { if (event.target === overlay) closeFollowsModal(); });
        overlay.querySelector('.profile-follows-close').addEventListener('click', closeFollowsModal);
        overlay.querySelectorAll('[data-follows-tab]').forEach((button) => button.addEventListener('click', () => {
            if (!followsModalState || button.dataset.followsTab === followsModalState.tab) return;
            followsModalState.tab = button.dataset.followsTab;
            renderFollowsTabs();
            loadFollowsModalUsers();
        }));
        window.addEventListener('aero:language-change', () => {
            if (!followsModalState) return;
            renderFollowsTabs();
            renderFollowsModalUsers();
        });
        return overlay;
    }

    function renderFollowsTabs() {
        const overlay = document.getElementById('profile-follows-modal');
        if (!overlay || !followsModalState) return;
        const { tab, counts } = followsModalState;
        overlay.querySelector('[data-follows-tab="followers"]').innerHTML = `<span data-i18n="Followers">${followsText('Followers')}</span> <span>${counts.followers}</span>`;
        overlay.querySelector('[data-follows-tab="following"]').innerHTML = `<span data-i18n="Following">${followsText('Following')}</span> <span>${counts.following}</span>`;
        overlay.querySelectorAll('[data-follows-tab]').forEach((button) => {
            const active = button.dataset.followsTab === tab;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', String(active));
        });
        overlay.querySelector('.profile-follows-indicator').dataset.tab = tab;
        overlay.querySelector('.profile-follows-modal').setAttribute('aria-label', `${followsText('Followers')} / ${followsText('Following')}`);
        overlay.querySelector('.profile-follows-close').setAttribute('aria-label', followsText('Close'));
    }

    function renderFollowsModalUsers() {
        const overlay = document.getElementById('profile-follows-modal');
        const list = overlay?.querySelector('.profile-follows-list');
        if (!list || !followsModalState) return;
        const { users, loading, error, tab, viewerId } = followsModalState;
        if (loading) {
            list.innerHTML = `<p class="profile-follows-state">${followsText('Loading people...')}</p>`;
            return;
        }
        if (error) {
            list.innerHTML = `<p class="profile-follows-state is-error">${profileEscape(error)}</p>`;
            return;
        }
        if (!users.length) {
            list.innerHTML = `<p class="profile-follows-state">${followsText('No people to show yet.')}</p>`;
            return;
        }
        list.innerHTML = users.map((person) => {
            const avatar = profileAvatarValue(person);
            const following = Boolean(person.is_following);
            const labelKey = following ? 'Following' : tab === 'followers' && person.is_followed_by ? 'Follow back' : 'Follow';
            const label = followsText(labelKey);
            const action = Number(person.id) === viewerId ? '' : `<button type="button" class="profile-follows-action ${following ? 'is-following' : ''}" data-follows-action="${person.id}" title="${followsText(following ? 'Unfollow' : 'Follow')}"><span data-i18n="${labelKey}">${label}</span></button>`;
            return `<div class="profile-follows-user"><button type="button" class="profile-follows-user-main" data-open-follow-profile="${person.id}"><img class="profile-follows-avatar" src="${profileEscape(avatar.url)}" data-avatar-fallback="${profileEscape(avatar.fallbackUrl)}" alt=""/><span class="profile-follows-user-copy"><strong>@${profileEscape(person.username)}</strong><small>${profileEscape(person.display_name || person.username)}</small></span></button>${action}</div>`;
        }).join('');
        list.querySelectorAll('[data-avatar-fallback]').forEach((image) => image.addEventListener('error', () => { image.src = image.dataset.avatarFallback; }, { once: true }));
        list.querySelectorAll('[data-open-follow-profile]').forEach((button) => button.addEventListener('click', () => {
            const userId = Number(button.dataset.openFollowProfile);
            closeFollowsModal();
            window.switchView?.('profile', { userId });
        }));
        list.querySelectorAll('[data-follows-action]').forEach((button) => button.addEventListener('click', async () => {
            const person = followsModalState?.users.find((item) => String(item.id) === button.dataset.followsAction);
            if (!person || !followsModalState) return;
            if (!localStorage.getItem('aero_token')) {
                window.showLoginModal?.('Please sign in before following people.');
                return;
            }
            const wasFollowing = Boolean(person.is_following);
            button.disabled = true;
            try {
                const result = await window.toggleFollowUser(person.id, { username: person.username, name: person.display_name, avatar: person.avatar_url });
                person.is_following = Boolean(result.is_following);
                if (followsModalState.isOwnProfile) {
                    followsModalState.counts.following = Math.max(0, followsModalState.counts.following + (person.is_following ? 1 : -1));
                    followsModalState.onFollowingCountChange?.(followsModalState.counts.following);
                }
                if (followsModalState.isOwnProfile && followsModalState.tab === 'following' && wasFollowing && !person.is_following) {
                    followsModalState.users = followsModalState.users.filter((item) => Number(item.id) !== Number(person.id));
                }
                renderFollowsTabs();
                renderFollowsModalUsers();
            } catch (error) {
                window.showNotice?.(error.message || followsText('Unable to update follow status.'), 'error');
                button.disabled = false;
            }
        }));
    }

    async function loadFollowsModalUsers() {
        if (!followsModalState) return;
        const state = followsModalState;
        const tab = state.tab;
        const requestId = state.requestId = (state.requestId || 0) + 1;
        state.loading = true;
        state.error = '';
        renderFollowsModalUsers();
        try {
            const response = await fetch(`${profileApiBase()}/users/${state.userId}/follows?type=${tab}`, {
                headers: window.AeroAuthHeaders?.() || {}
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || followsText('Unable to load this list.'));
            if (followsModalState !== state || state.requestId !== requestId || state.tab !== tab) return;
            state.users = Array.isArray(payload.users) ? payload.users : [];
            state.counts = { followers: Number(payload.followers_count) || 0, following: Number(payload.following_count) || 0 };
        } catch (error) {
            if (followsModalState === state && state.requestId === requestId && state.tab === tab) state.error = error.message || followsText('Unable to load this list.');
        } finally {
            if (followsModalState === state && state.requestId === requestId && state.tab === tab) {
                state.loading = false;
                renderFollowsTabs();
                renderFollowsModalUsers();
            }
        }
    }

    function openFollowsModal({ userId, initialTab, followersCount, followingCount, isOwnProfile, onFollowingCountChange }) {
        const overlay = ensureFollowsModal();
        followsModalState = {
            userId: Number(userId),
            initialTab: initialTab === 'following' ? 'following' : 'followers',
            tab: initialTab === 'following' ? 'following' : 'followers',
            counts: { followers: Number(followersCount) || 0, following: Number(followingCount) || 0 },
            isOwnProfile,
            viewerId: Number(JSON.parse(localStorage.getItem('aero_user') || '{}').id || 0),
            users: [],
            requestId: 0,
            loading: false,
            error: '',
            onFollowingCountChange
        };
        overlay.classList.remove('hidden');
        document.body.classList.add('has-profile-follows-modal');
        renderFollowsTabs();
        loadFollowsModalUsers();
        overlay.querySelector('.profile-follows-close').focus();
    }

    function closeFollowsModal() {
        const overlay = document.getElementById('profile-follows-modal');
        overlay?.classList.add('hidden');
        document.body.classList.remove('has-profile-follows-modal');
        followsModalState = null;
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
        return Boolean(window.isSecureContext && 'NDEFReader' in window);
    }

    function profileShareUrl(userId) {
        const username = typeof userId === 'object' ? userId.username : userId;
        const profileUrl = new URL(window.location.href);
        profileUrl.searchParams.set('user', username);
        profileUrl.searchParams.delete('profile');
        profileUrl.hash = '';
        return profileUrl.toString();
    }

    function nfcText(key) {
        return window.AeroI18n?.t?.(`share.nfc.${key}`) || key;
    }

    function setNfcStatus(message, active = false) {
        const status = document.getElementById('nfc-share-status');
        if (status) status.textContent = message;
        const panel = document.getElementById('nfc-share-panel');
        panel?.classList.toggle('is-active', active);
        panel?.classList.toggle('is-unavailable', !checkNFCSupport());
    }

    async function startNFCShare(profileUrl) {
        const fallbackToClipboard = async () => {
            try {
                await navigator.clipboard.writeText(profileUrl);
                setNfcStatus(nfcText('copied'));
                window.showNotice?.('NFC 写入不可用，已自动复制 Profile 链接至剪贴板', 'info');
            } catch (clipboardError) {
                setNfcStatus(nfcText('write_failed'));
                window.showNotice?.('NFC writing is unavailable. Please copy the Profile link manually.', 'info');
            }
        };
        if (!checkNFCSupport()) {
            setNfcStatus(nfcText('unsupported'));
            return false;
        }
        setNfcStatus(nfcText('instructions'), true);
        try {
            const ndef = new NDEFReader();
            await ndef.write({ records: [{ recordType: 'url', data: profileUrl }] });
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            setNfcStatus(nfcText('success'));
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
        const nfcButton = document.getElementById('start-nfc-share');
        nfcButton.dataset.profileUrl = profileUrl;
        nfcButton.disabled = !checkNFCSupport();
        nfcButton.setAttribute('aria-describedby', 'nfc-share-status');
        nfcButton.title = checkNFCSupport() ? nfcText('instructions') : nfcText('unsupported');
        setNfcStatus(checkNFCSupport() ? nfcText('instructions') : nfcText('unsupported'));
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
        if (view === 'profile' || view === 'post') return;
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
        } else if (view === 'profile' || view === 'post') {
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

    function setupDockEdgeScroll() {
        const dockList = document.querySelector('.dock-right .dock-scroll-wrapper');
        if (!dockList) return;

        let pointerY = null;
        let animationFrame = 0;
        let previousFrameTime = 0;

        const stopScrolling = () => {
            pointerY = null;
            previousFrameTime = 0;
            window.cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        };

        const scrollAtEdge = (time) => {
            if (pointerY === null) return;

            const rect = dockList.getBoundingClientRect();
            const edgeSize = Math.min(45, rect.height / 3);
            const localY = pointerY - rect.top;
            let direction = 0;
            let intensity = 0;

            if (localY < edgeSize) {
                direction = -1;
                intensity = (edgeSize - localY) / edgeSize;
            } else if (localY > rect.height - edgeSize) {
                direction = 1;
                intensity = (localY - (rect.height - edgeSize)) / edgeSize;
            }

            if (!direction || !intensity ||
                (direction < 0 && dockList.scrollTop <= 0) ||
                (direction > 0 && dockList.scrollTop >= dockList.scrollHeight - dockList.clientHeight)) {
                animationFrame = 0;
                previousFrameTime = 0;
                return;
            }

            const elapsed = previousFrameTime ? Math.min(time - previousFrameTime, 32) : 16;
            previousFrameTime = time;
            dockList.scrollTop += direction * 360 * Math.min(intensity, 1) * elapsed / 1000;
            animationFrame = window.requestAnimationFrame(scrollAtEdge);
        };

        dockList.addEventListener('mousemove', (event) => {
            pointerY = event.clientY;
            if (!animationFrame) animationFrame = window.requestAnimationFrame(scrollAtEdge);
        });
        dockList.addEventListener('mouseleave', stopScrolling);
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
        await window.AeroMentionDirectoryReady;
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
                    headers: window.AeroAuthHeaders?.() || {}
                });
                const profilePayload = await profileResponse.json().catch(() => ({}));
                if (!profileResponse.ok || !profilePayload.user?.id) throw new Error(profilePayload.message || 'Profile not found');
                profileUserId = Number(profilePayload.user.id);
            } else if (sharedUsername) {
                profileUserId = Number(sharedUsername);
            }
            const response = await fetch(`${apiBase}/${profileUserId && profileUserId !== currentUserId ? `users/${profileUserId}` : 'users/me'}`, {
                headers: window.AeroAuthHeaders?.() || {}
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Unable to load profile');

            const user = payload.user || {};
            let posts = Array.isArray(payload.posts) ? payload.posts : [];
            if (profileUserId && profileUserId !== currentUserId) {
                const postsResponse = await fetch(`${apiBase}/posts?author_id=${profileUserId}`, {
                    headers: window.AeroAuthHeaders?.() || {}
                });
                const authorPosts = await postsResponse.json().catch(() => []);
                const authorPostItems = Array.isArray(authorPosts) ? authorPosts : authorPosts.posts;
                if (postsResponse.ok && Array.isArray(authorPostItems)) posts = authorPostItems;
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
                            <h2><span class="profile-display-name"></span>${profileRoleBadge(user.role)}</h2>
                            ${isOwnProfile ? '<button type="button" class="profile-share-btn" id="profile-share-btn" aria-label="Share profile" title="Share profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"></path></svg></button>' : ''}
                        </div>
                        <div class="profile-handle">@${user.username || 'user'}</div>
                        <p class="profile-bio">${(user.bio || 'No bio yet.').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]))}</p>
                        ${isOwnProfile ? '<button type="button" class="profile-edit-btn">Edit Profile</button>' : `<div class="profile-action-group"><button id="profile-follow-btn" type="button" class="profile-follow-btn ${payload.is_following ? 'is-following' : ''}" data-user-id="${profileUserId}" data-following="${Boolean(payload.is_following)}">${payload.is_following ? 'Following' : 'Follow'}</button><button type="button" class="profile-message-btn" data-user-id="${profileUserId}">Message</button></div>`}
                        <div class="profile-stats">
                            <button type="button" class="profile-stat-trigger" data-follows-tab="followers" aria-label="View followers"><strong id="profile-followers-count">${followText(payload.followers_count)}</strong><span data-i18n="Followers" data-i18n-text>Followers</span></button>
                            <button type="button" class="profile-stat-trigger" data-follows-tab="following" aria-label="View following"><strong id="profile-following-count">${followText(payload.following_count)}</strong><span data-i18n="Following" data-i18n-text>Following</span></button>
                        </div>
                    </div>
                    <div class="profile-avatar-wrap ${user.is_online ? 'is-online' : ''}">
                        <img class="profile-avatar" src="${avatar || avatarValue.fallbackUrl}" data-avatar-fallback="${avatarValue.fallbackUrl}" alt="${(user.username || 'User').replace(/"/g, '&quot;')}" onerror="this.onerror=null;this.src=this.dataset.avatarFallback" />
                    </div>
                </div>
            `;

            header.querySelector('.profile-display-name').textContent = user.display_name || user.username || 'User';
            header.querySelector('#profile-share-btn')?.addEventListener('click', () => {
                if (isOwnProfile) openProfileShareModal(user, profileUserId);
            });
            header.querySelectorAll('[data-follows-tab]').forEach((button) => button.addEventListener('click', () => {
                const followersCount = header.querySelector('#profile-followers-count');
                const followingCount = header.querySelector('#profile-following-count');
                openFollowsModal({
                    userId: profileUserId,
                    initialTab: button.dataset.followsTab,
                    followersCount: followersCount?.textContent,
                    followingCount: followingCount?.textContent,
                    isOwnProfile,
                    onFollowingCountChange: (count) => { if (followingCount) followingCount.textContent = String(count); }
                });
            }));
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
                    if (!window.requireAuth?.(null, 'Please sign in before starting a chat.')) return;
                    window.switchView('chat');
                    window.loadChatContacts?.();
                    window.selectChatContact?.({ id: profileUserId, username: user.username, avatar_url: user.avatar_url, is_online: user.is_online });
                });
            }

            container.innerHTML = posts.length ? posts.map((post) => {
                const postId = Number(post.id);
                if (!Number.isInteger(postId) || postId <= 0) return '';
                const username = String(user.username || 'user').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
                return `
                <article class="post-card profile-post-card glass-card liquid-glass liquid-glass-interactive pop-in g2-card" data-post-id="${postId}" tabindex="0" role="link" aria-label="Open post by @${username}">
                    <div class="post-header">
                        <div class="post-author-identity">
                            <span class="post-avatar ${user.is_online ? 'is-online' : ''}"><img src="${avatar || avatarValue.fallbackUrl}" data-avatar-fallback="${avatarValue.fallbackUrl}" alt="@${username}" onerror="this.onerror=null;this.src=this.dataset.avatarFallback" /></span>
                            <span class="post-author">@${username}${profileRoleBadge(user.role)}</span>
                            <time class="post-relative-time">${window.AeroFormatRelativeTime?.(post.created_at) || new Date(post.created_at || Date.now()).toLocaleDateString()}</time>
                        </div>
                    </div>
                    <div class="post-content">${window.AeroMentionText?.(post.content || '') || (post.content || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]))}</div>
                </article>
            `;
            }).join('') : '<div class="post-card glass-card text-center"><p>No posts yet.</p></div>';
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
        await window.AeroMentionDirectoryReady;
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
                container.innerHTML = `<div class="profile-shorts-grid">${items.map((item) => { const videoType = /\.mov(?:$|\?)/i.test(item.video_url) ? 'video/quicktime' : /\.webm(?:$|\?)/i.test(item.video_url) ? 'video/webm' : /\.m4v(?:$|\?)/i.test(item.video_url) ? 'video/x-m4v' : 'video/mp4'; return `<article class="profile-short-card"><video muted playsinline preload="metadata" controls crossorigin="anonymous"><source src="${escape(item.video_url)}" type="${videoType}"></video><strong>${escape(item.caption || 'Untitled Short')}</strong><small>${Number(item.views_count || 0)} views</small></article>`; }).join('')}</div>`;
                return;
            }
            container.innerHTML = items.map((item) => {
                const postId = Number(item.post_id || item.post?.id || item.id);
                if (!Number.isInteger(postId) || postId <= 0) return '';
                const content = contentType === 'replies' ? item.content : item.content;
                const summary = contentType === 'replies' ? `<small class="profile-content-context">On @${escape(item.post?.username)}: ${escape(item.post?.content)}</small>` : '';
                const renderedContent = window.AeroMentionText?.(content) || escape(content);
                const fallbackUrl = profileAvatarValue(user).fallbackUrl;
                return `<article class="post-card profile-post-card glass-card liquid-glass liquid-glass-interactive pop-in g2-card" data-post-id="${postId}" tabindex="0" role="link" aria-label="Open post by @${escape(user.username)}"><div class="post-header"><div class="post-author-identity"><span class="post-avatar ${user.is_online ? 'is-online' : ''}"><img src="${escape(avatar || fallbackUrl)}" data-avatar-fallback="${fallbackUrl}" alt="@${escape(user.username)}" onerror="this.onerror=null;this.src=this.dataset.avatarFallback"></span><span class="post-author">@${escape(user.username)}${profileRoleBadge(user.role)}</span><time class="post-relative-time">${window.AeroFormatRelativeTime?.(item.created_at) || new Date(item.created_at || Date.now()).toLocaleDateString()}</time></div></div><div class="post-content">${renderedContent}</div>${summary}</article>`;
            }).join('');
        } catch (error) {
            container.innerHTML = `<div class="post-card glass-card text-center"><p>${error.message}</p></div>`;
        }
    }

    const escapePostDetail = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

    function postDetailMediaUrl(value) {
        const source = typeof value === 'string' ? value : value?.url || '';
        if (!source || /^(https?:|data:|blob:)/i.test(source)) return source;
        return `${window.AeroConfig.API_ORIGIN}${source.startsWith('/') ? source : `/${source}`}`;
    }

    function renderPostDetailComment(comment, ownerId, depth = 0) {
        const avatar = profileAvatarValue(comment);
        const username = escapePostDetail(comment.username || `user${comment.user_id}`);
        const content = window.AeroMentionText?.(comment.content || '') || escapePostDetail(comment.content);
        const imageUrl = postDetailMediaUrl(comment.image_url);
        const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
        const canDelete = Number(comment.user_id) === Number(currentUser.id) || currentUser.is_admin === true || ['admin', 'moderator'].includes(currentUser.role);
        const replies = Array.isArray(comment.replies) ? comment.replies.map((reply) => renderPostDetailComment(reply, ownerId, depth + 1)).join('') : '';
        const commentId = Number(comment.id);

        return `<article class="comment-item${depth ? ' reply-item' : ''}" data-detail-comment-id="${commentId}">
            <div class="comment-header"><span class="comment-avatar-wrap"><img class="comment-avatar" src="${escapePostDetail(avatar.url)}" alt=""></span><div class="comment-meta-line"><strong>@${username}${profileRoleBadge(comment.role)}</strong><time class="comment-relative-time">${window.AeroFormatRelativeTime?.(comment.created_at) || ''}</time></div></div>
            <p>${content}</p>${imageUrl ? `<img class="comment-gif" src="${escapePostDetail(imageUrl)}" alt="Comment attachment" loading="lazy">` : ''}
            <div class="comment-actions"><button type="button" class="comment-action-btn" data-detail-comment-like data-liked="${Boolean(comment.is_liked)}" aria-label="${comment.is_liked ? 'Unlike' : 'Like'} comment">${comment.is_liked ? '♥' : '♡'} <span>${Number(comment.likes_count) || 0}</span></button><button type="button" class="comment-action-btn comment-reply-btn" data-detail-comment-reply="${commentId}" data-username="${username}">Reply</button>${canDelete ? '<button type="button" class="comment-action-btn" data-detail-comment-delete>Delete</button>' : ''}</div>${replies}
        </article>`;
    }

    async function loadPostDetail(postId) {
        await window.AeroMentionDirectoryReady;
        const container = document.getElementById('post-detail-content');
        if (!container) return;
        const requestId = ++postDetailRequestId;
        container.innerHTML = '<p class="post-detail-loading" role="status">Loading post...</p>';

        try {
            const post = await window.AeroAPI.getPost(postId);
            if (requestId !== postDetailRequestId) return;
            const authorAvatar = profileAvatarValue(post);
            const username = escapePostDetail(post.username || 'User');
            const content = window.AeroMentionText?.(post.content || '') || escapePostDetail(post.content);
            const media = (Array.isArray(post.images) ? post.images : []).map(postDetailMediaUrl).filter(Boolean);
            const mediaMarkup = media.length ? `<div class="post-media-container post-detail-media">${media.map((url, index) => /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(url)
                ? `<button type="button" class="post-media-item post-video-placeholder" data-detail-media-index="${index}" aria-label="Play video ${index + 1} of ${media.length}"><span class="post-video-placeholder-icon" aria-hidden="true">▶</span><span class="post-video-placeholder-label">Play video</span></button>`
                : `<img class="post-media-item" src="${escapePostDetail(url)}" alt="Post media" loading="lazy" data-detail-media-index="${index}" tabindex="0" role="button" aria-label="Open media ${index + 1} of ${media.length}">`).join('')}</div>` : '';
            const threadMarkup = (Array.isArray(post.thread_posts) ? post.thread_posts : []).map((entry) => {
                const entryUsername = escapePostDetail(entry.username || post.username || 'User');
                const entryContent = window.AeroMentionText?.(entry.content || '') || escapePostDetail(entry.content);
                const entryMedia = (Array.isArray(entry.images) ? entry.images : []).map((item) => {
                    const url = postDetailMediaUrl(item);
                    return /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(url)
                        ? `<video class="post-media-item" src="${escapePostDetail(url)}" controls playsinline preload="metadata"></video>`
                        : `<img class="post-media-item" src="${escapePostDetail(url)}" alt="Thread post media" loading="lazy">`;
                }).join('');
                return `<article class="post-thread-item"><strong>@${entryUsername}</strong><div class="post-content">${entryContent}</div>${entryMedia ? `<div class="post-media-container">${entryMedia}</div>` : ''}</article>`;
            }).join('');
            const relativeTime = window.AeroFormatRelativeTime?.(post.created_at) || new Date(post.created_at || Date.now()).toLocaleDateString();

            container.innerHTML = `<article class="post-card glass-card liquid-glass liquid-glass-interactive g2-card" data-post-id="${Number(post.id)}">
                <header class="post-header"><div class="post-author-info post-author-identity"><a class="post-author-link" href="#profile/${Number(post.user_id)}" aria-label="Open @${username} profile"><span class="post-avatar ${post.is_online ? 'is-online' : ''}"><img src="${escapePostDetail(authorAvatar.url)}" alt=""></span><span class="post-author">@${username}${profileRoleBadge(post.role)}</span></a><time class="post-relative-time">${escapePostDetail(relativeTime)}</time></div></header>
                <div class="post-content">${content}</div>${mediaMarkup}${threadMarkup ? `<section class="post-thread-list" aria-label="Thread posts">${threadMarkup}</section>` : ''}
                <div class="post-actions"><div class="action-capsule">
                    <button type="button" class="post-action-btn${post.is_liked ? ' is-liked' : ''}" data-detail-like aria-label="${post.is_liked ? 'Unlike' : 'Like'} post">${post.is_liked ? '♥' : '♡'} <span>${Number(post.likes_count) || 0}</span></button>
                    <button type="button" class="post-action-btn" data-detail-comment aria-label="Go to comments">♧ <span>${Number(post.comments_count) || 0}</span></button>
                    <button type="button" class="post-action-btn" data-detail-repost aria-label="Repost">↻</button>
                    <button type="button" class="post-action-btn" data-detail-bookmark aria-label="${post.is_bookmarked ? 'Remove bookmark' : 'Bookmark post'}">${post.is_bookmarked ? '★' : '☆'}</button>
                    <button type="button" class="post-action-btn" data-detail-share aria-label="Copy post link">↗</button>
                </div></div>
                <section class="comments-panel"><div class="comments-list" data-detail-comments aria-live="polite"></div><form class="comment-composer" data-detail-comment-form><input type="text" maxlength="1000" placeholder="Write a comment..." aria-label="Write a comment"><button type="submit" class="comment-send-btn" aria-label="Send comment">➤</button></form></section>
            </article>`;

            const likeButton = container.querySelector('[data-detail-like]');
            const likeCount = likeButton.querySelector('span');
            likeButton.addEventListener('click', async () => {
                if (likeButton.disabled) return;
                const wasLiked = Boolean(post.is_liked);
                post.is_liked = !wasLiked;
                likeButton.disabled = true;
                likeButton.classList.toggle('is-liked', post.is_liked);
                likeButton.setAttribute('aria-label', `${post.is_liked ? 'Unlike' : 'Like'} post`);
                likeButton.firstChild.textContent = post.is_liked ? '♥ ' : '♡ ';
                likeCount.textContent = String(Math.max(0, (Number(likeCount.textContent) || 0) + (post.is_liked ? 1 : -1)));
                try {
                    const result = wasLiked ? await window.AeroAPI.cancelLikePost(post.id) : await window.AeroAPI.likePost(post.id);
                    likeCount.textContent = String(result.like_count ?? likeCount.textContent);
                } catch (error) {
                    post.is_liked = wasLiked;
                    likeButton.classList.toggle('is-liked', wasLiked);
                    likeButton.setAttribute('aria-label', `${wasLiked ? 'Unlike' : 'Like'} post`);
                    likeButton.firstChild.textContent = wasLiked ? '♥ ' : '♡ ';
                    likeCount.textContent = String(Math.max(0, (Number(likeCount.textContent) || 0) + (wasLiked ? 1 : -1)));
                    window.showNotice?.(error.message || 'Unable to update like.', 'error');
                } finally { likeButton.disabled = false; }
            });

            container.querySelector('[data-detail-comment]').addEventListener('click', () => container.querySelector('[data-detail-comment-form] input').focus());
            container.querySelector('[data-detail-repost]').addEventListener('click', async () => {
                try {
                    await window.AeroAPI.repostPost(post.id);
                    window.showNotice?.('Post reposted.', 'success');
                } catch (error) { window.showNotice?.(error.message || 'Unable to repost.', 'error'); }
            });
            const bookmarkButton = container.querySelector('[data-detail-bookmark]');
            bookmarkButton.addEventListener('click', async () => {
                try {
                    const result = await window.AeroAPI.toggleBookmark(post.id);
                    post.is_bookmarked = Boolean(result.bookmarked);
                    bookmarkButton.textContent = post.is_bookmarked ? '★' : '☆';
                    bookmarkButton.setAttribute('aria-label', post.is_bookmarked ? 'Remove bookmark' : 'Bookmark post');
                } catch (error) { window.showNotice?.(error.message || 'Unable to update bookmark.', 'error'); }
            });
            container.querySelector('[data-detail-share]').addEventListener('click', async () => {
                const permalink = new URL(window.location.href);
                permalink.hash = `post/${post.id}`;
                try {
                    await navigator.clipboard.writeText(permalink.href);
                    window.AeroAPI.recordShareStats(post.id, 'copy').catch(() => {});
                    window.showNotice?.('Post link copied.', 'success');
                } catch (error) { window.showNotice?.('Unable to copy post link.', 'error'); }
            });
            container.querySelector('.post-author-link').addEventListener('click', (event) => {
                event.preventDefault();
                window.navigateToUserProfile?.(Number(post.user_id));
            });
            container.querySelectorAll('[data-detail-media-index]').forEach((mediaElement) => {
                const openMedia = () => window.openThreadsMediaViewer?.(media, Number(mediaElement.dataset.detailMediaIndex));
                mediaElement.addEventListener('click', openMedia);
                if (mediaElement.tagName === 'IMG') mediaElement.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openMedia();
                    }
                });
            });

            const commentsList = container.querySelector('[data-detail-comments]');
            const loadComments = async () => {
                commentsList.innerHTML = '<p class="comments-loading">Loading comments...</p>';
                try {
                    const comments = await window.AeroAPI.getComments(post.id);
                    commentsList.innerHTML = comments.length ? comments.map((comment) => renderPostDetailComment(comment, post.user_id)).join('') : '<p class="comments-empty">No comments yet.</p>';
                    commentsList.querySelectorAll('[data-detail-comment-like]').forEach((button) => {
                        button.addEventListener('click', async () => {
                            const comment = button.closest('[data-detail-comment-id]');
                            const commentId = Number(comment.dataset.detailCommentId);
                            const wasLiked = button.dataset.liked === 'true';
                            button.disabled = true;
                            try {
                                const result = await window.AeroAPI.toggleCommentLike(commentId, wasLiked);
                                button.dataset.liked = String(Boolean(result.liked));
                                button.firstChild.textContent = result.liked ? '♥ ' : '♡ ';
                                button.querySelector('span').textContent = String(result.like_count ?? 0);
                            } catch (error) { window.showNotice?.(error.message || 'Unable to update comment like.', 'error'); }
                            finally { button.disabled = false; }
                        });
                    });
                    commentsList.querySelectorAll('[data-detail-comment-reply]').forEach((button) => {
                        button.addEventListener('click', () => {
                            const form = container.querySelector('[data-detail-comment-form]');
                            const input = form.querySelector('input');
                            form.dataset.parentId = button.dataset.detailCommentReply;
                            input.placeholder = `Reply to @${button.dataset.username}...`;
                            input.focus();
                        });
                    });
                    commentsList.querySelectorAll('[data-detail-comment-delete]').forEach((button) => {
                        button.addEventListener('click', async () => {
                            const comment = button.closest('[data-detail-comment-id]');
                            try {
                                await window.AeroAPI.deleteComment(Number(comment.dataset.detailCommentId));
                                comment.remove();
                            } catch (error) { window.showNotice?.(error.message || 'Unable to delete comment.', 'error'); }
                        });
                    });
                } catch (error) {
                    commentsList.innerHTML = `<p class="comments-empty">${escapePostDetail(error.message || 'Unable to load comments.')}</p>`;
                }
            };
            const commentForm = container.querySelector('[data-detail-comment-form]');
            commentForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const input = commentForm.querySelector('input');
                const content = input.value.trim();
                if (!content) return;
                try {
                    await window.AeroAPI.sendComment(post.id, content, Number(commentForm.dataset.parentId) || null);
                    input.value = '';
                    input.placeholder = 'Write a comment...';
                    delete commentForm.dataset.parentId;
                    post.comments_count = (Number(post.comments_count) || 0) + 1;
                    container.querySelector('[data-detail-comment] span').textContent = String(post.comments_count);
                    await loadComments();
                } catch (error) { window.showNotice?.(error.message || 'Unable to send comment.', 'error'); }
            });
            await loadComments();
        } catch (error) {
            if (requestId === postDetailRequestId) container.innerHTML = `<p class="post-detail-error" role="alert">${escapePostDetail(error.message || 'Unable to load post.')}</p>`;
        }
    }

    function navigateToPostDetail(postId, options = {}) {
        const id = Number(postId);
        if (!Number.isInteger(id) || id <= 0) return false;
        if (activeView !== 'post') postDetailReturn = { view: activeView === 'profile' ? 'profile' : 'main', userId: activeProfileUserId };
        postDetailHistoryEntry = options.pushHistory !== false;
        if (postDetailHistoryEntry) history.pushState({ postDetailId: id }, '', `${window.location.pathname}${window.location.search}#post/${id}`);
        switchView('post');
        loadPostDetail(id);
        return true;
    }

    function closePostDetail() {
        if (postDetailHistoryEntry) {
            postDetailHistoryEntry = false;
            history.back();
            return;
        }
        const returnView = postDetailReturn || { view: 'main', userId: null };
        if (/^#post\/\d+$/.test(window.location.hash)) history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
        switchView(returnView.view, { userId: returnView.userId });
    }

    function setupProfilePostNavigation() {
        const container = document.getElementById('profile-posts-container');
        if (!container) return;
        const openCard = (card) => navigateToPostDetail(card.dataset.postId);
        const isInteractive = (target) => target.closest('button, a, input, textarea, video, .post-actions, .post-location-link, .avatar-link');

        container.addEventListener('click', (event) => {
            const card = event.target.closest('.profile-post-card');
            if (!card || !container.contains(card) || isInteractive(event.target)) return;
            openCard(card);
        });
        container.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const card = event.target.closest('.profile-post-card');
            if (!card || !container.contains(card) || isInteractive(event.target)) return;
            event.preventDefault();
            openCard(card);
        });
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
        document.getElementById('post-detail-back')?.addEventListener('click', closePostDetail);
        setupProfilePostNavigation();
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
                if (dockButton.id === 'chat-dock-btn' && !window.requireAuth?.(null, 'Please sign in before opening chat.')) return;
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
        const initialFeedType = routeParams.get('tab') === 'following' ? 'following' : 'for_you';
        const profilePath = window.location.pathname.match(/^\/profile\/([^/]+)\/?$/);
        const hashtagPath = window.location.pathname.match(/^\/hashtag\/([^/]+)\/?$/);
        if (profilePath && !routeParams.has('user')) {
            routeParams.set('user', decodeURIComponent(profilePath[1]));
            history.replaceState({}, '', `${window.location.pathname}?${routeParams.toString()}`);
        }
        const sharedProfile = (routeParams.get('user') || routeParams.get('profile') || '').trim();
        const legacyProfile = window.location.hash.match(/^#profile\/(\d+)$/);
        const postRoute = window.location.hash.match(/^#post\/(\d+)$/);
        if (hashtagPath) {
            navigate('main');
            window.AeroHashtags?.showPage(decodeURIComponent(hashtagPath[1]), false);
        }
        else if (postRoute) navigateToPostDetail(postRoute[1], { pushHistory: false });
        else if (sharedProfile) navigate('profile', { userId: /^\d+$/.test(sharedProfile) ? Number(sharedProfile) : sharedProfile });
        else if (legacyProfile) navigate('profile', { userId: Number(legacyProfile[1]) });
        else navigate('main');
        const chatUserId = Number(routeParams.get('user_id'));
        if (Number.isInteger(chatUserId) && chatUserId > 0) {
            window.setTimeout(() => window.AeroOpenChatWithUser?.(chatUserId), 0);
        }
        window.addEventListener('popstate', () => {
            const currentPost = window.location.hash.match(/^#post\/(\d+)$/);
            if (currentPost) {
                navigateToPostDetail(currentPost[1], { pushHistory: false });
                return;
            }
            if (activeView === 'post') {
                postDetailHistoryEntry = false;
                const returnView = postDetailReturn || { view: 'main', userId: null };
                switchView(returnView.view, { userId: returnView.userId });
                return;
            }
            const currentHashtag = window.location.pathname.match(/^\/hashtag\/([^/]+)\/?$/);
            if (currentHashtag) {
                navigate('main');
                window.AeroHashtags?.showPage(decodeURIComponent(currentHashtag[1]), false);
            } else window.AeroAPI?.renderFeed('for_you');
        });
        setActiveFeedTab(initialFeedType);
        setFabAuthState(Boolean(localStorage.getItem('aero_token')));
        setupScrollPerformance();
        setupDockEdgeScroll();
        window.addEventListener('resize', syncFabForViewport, { passive: true });
        window.addEventListener('resize', updateTabIndicator, { passive: true });
        updateTabIndicator();
    });

    window.setFabAuthState = setFabAuthState;
    window.setActiveNavItem = setActiveNavItem;
    window.switchView = switchView;
    window.navigateToUserProfile = navigateToUserProfile;
    window.navigateToPostDetail = navigateToPostDetail;
    window.AeroRouter = { navigate, switchView, get activeView() { return activeView; } };
    window.checkNFCSupport = checkNFCSupport;
    window.startNFCShare = startNFCShare;
})();
