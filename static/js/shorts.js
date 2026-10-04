// Short-video feed and video interaction controller
// From: index.html shorts view -> To: /api/video endpoints and video tables
(() => {
    const apiBase = window.AeroConfig.API_BASE_URL;
    let videos = [];
    let currentIndex = 0;
    let activeMedia = null;
    let shortObserver = null;
    let tapTimer = 0;
    let tapPage = null;
    let shortsCommentsCloseTimer = 0;
    let shortsCommentsAnimationEnd = null;
    let shortCardPositionAnimation = null;
    let isChangingVideo = false;
    let videoChangeTimeout = 0;

    const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` });
    const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const parseGifContent = (content, mediaUrl = '', type = '') => {
        const match = String(content || '').match(/https?:\/\/[^\s<>"']+(?:\.gif(?:\?[^\s<>"']*)?|(?:media|i)\.giphy\.com|tenor\.com[^\s<>"']*)/i);
        const url = mediaUrl || (String(type).toLowerCase() === 'gif' ? match?.[0] : match?.[0]);
        return url ? { url, text: String(content || '').replace(url, '').replace('[GIF]', '').trim() } : { url: '', text: String(content || '') };
    };
    const extractGifUrl = (content) => parseGifContent(content).url;
    const mediaUrl = (url) => String(url || '').startsWith('http') ? url : `${apiBase.replace(/\/api$/, '')}${url}`;
    const showShortNotice = (message, type = 'info') => {
        if (typeof window.showNotice === 'function') window.showNotice(message, type);
    };
    const getStoredUser = () => {
        try {
            return JSON.parse(localStorage.getItem('aero_user') || '{}');
        } catch {
            return {};
        }
    };
    const relativeTime = (value) => {
        const timestamp = new Date(value).getTime();
        if (!Number.isFinite(timestamp)) return '';
        const seconds = Math.round((timestamp - Date.now()) / 1000);
        const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
        const [unit, length] = units.find(([, size]) => Math.abs(seconds) >= size) || ['second', 1];
        try {
            return new Intl.RelativeTimeFormat(navigator.language, { numeric: 'auto' }).format(Math.round(seconds / length), unit);
        } catch {
            return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(seconds / length), unit);
        }
    };
    const animateShortCardShift = (container, startLeft) => {
        const card = container?.querySelector('.short-card');
        if (!card || !Number.isFinite(startLeft) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        shortCardPositionAnimation?.cancel();
        const distance = startLeft - card.getBoundingClientRect().left;
        if (Math.abs(distance) < 1) return;
        const overshoot = -Math.sign(distance) * Math.min(9, Math.abs(distance) * .1);
        shortCardPositionAnimation = card.animate([
            { transform: `translateX(${distance}px)` },
            { transform: `translateX(${overshoot}px)`, offset: .82 },
            { transform: 'translateX(0)' },
        ], { duration: 520, easing: 'cubic-bezier(.22, .78, .28, 1)' });
        shortCardPositionAnimation.onfinish = () => { shortCardPositionAnimation = null; };
        shortCardPositionAnimation.oncancel = () => { shortCardPositionAnimation = null; };
    };
    const icon = (name) => ({
        heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"></path></svg>',
        comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.5-.7L4 20l1.7-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"></path></svg>',
        share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 7 7-7 7M21 12H4"></path></svg>',
    })[name];

    function toggleMediaPlayback(page, media) {
        const indicator = page.querySelector('.short-playback-indicator');
        if (media.paused) {
            media.muted = false;
            media.play().catch((error) => showShortNotice(error.message || 'Unable to play this video', 'error'));
            indicator.textContent = '▶';
        } else {
            media.pause();
            indicator.textContent = '❚❚';
        }
        indicator.classList.remove('is-visible');
        void indicator.offsetWidth;
        indicator.classList.add('is-visible');
    }

    function renderCurrentVideo() {
        const stage = document.getElementById('shorts-stage');
        const currentUser = getStoredUser();
        const currentUserId = Number(currentUser.id || currentUser.user_id);
        const canModerateVideos = Boolean(currentUser.is_admin || ['admin', 'moderator'].includes(currentUser.role));
        activeMedia?.pause();
        activeMedia = null;
        shortObserver?.disconnect();
        window.clearTimeout(tapTimer);
        tapTimer = 0;
        tapPage = null;
        window.clearTimeout(videoChangeTimeout);
        videoChangeTimeout = 0;
        isChangingVideo = false;
        if (!stage || !videos.length) {
            if (stage) stage.innerHTML = `<div class="shorts-empty"><div class="shorts-empty-content"><span>${window.AeroI18n?.t('no_shorts') || 'No Shorts available yet.'}</span><button type="button" id="shorts-empty-upload" class="shorts-empty-upload">${window.AeroI18n?.t('upload_first_video') || '+ Upload First Video'}</button></div></div>`;
            return;
        }
        stage.innerHTML = videos.map((video, index) => {
            const author = video.author || video.user || {};
            const avatarUrl = author.avatar_url || video.author_avatar || '';
            const videoSourceType = /\.mov(?:$|\?)/i.test(video.video_url) ? 'video/quicktime' : /\.webm(?:$|\?)/i.test(video.video_url) ? 'video/webm' : /\.m4v(?:$|\?)/i.test(video.video_url) ? 'video/x-m4v' : 'video/mp4';
            const avatar = window.AeroAvatar?.markup({ ...author, avatar_url: avatarUrl }, 'short-author-avatar') || (avatarUrl ? `<img src="${escapeText(mediaUrl(avatarUrl))}" alt="" loading="lazy" decoding="async">` : escapeText((author.username || 'U').charAt(0).toUpperCase()));
            const canDelete = Number(video.authorId ?? author.id) === currentUserId || canModerateVideos;
            return `<section class="short-video-page" data-short-index="${index}"><article class="short-card"><video class="short-video-media" playsinline loop preload="${index === currentIndex ? 'metadata' : 'none'}" data-hdr-fallback="${!window.AeroMediaCapabilities?.isHDRSupported()}"><source src="${escapeText(mediaUrl(video.video_url))}" type="${videoSourceType}"></video><span class="short-playback-indicator" aria-hidden="true"></span><div class="short-card-overlay"><div class="short-card-copy"><div class="short-author">${avatar}<strong>@${escapeText(author.username || 'User')}</strong><button type="button" class="short-subscribe ${video.is_following ? 'subscribed' : ''}" data-user-id="${author.id || ''}">${video.is_following ? 'Subscribed' : 'Subscribe'}</button></div><p>${escapeText(video.caption)}</p><div class="short-track">♫ <span>${escapeText(video.track_name || 'Original audio')}</span></div></div><div class="short-interactions"><button type="button" class="short-action short-like-btn ${video.is_liked ? 'is-liked' : ''}" aria-label="Like" aria-pressed="${Boolean(video.is_liked)}">${icon('heart')}<small>${video.likes_count || 0}</small></button><button type="button" class="short-action short-comment-btn" aria-label="Comments" aria-expanded="false">${icon('comment')}<small>Comments</small></button><button type="button" class="short-action short-share-btn" aria-label="Share">${icon('share')}<small>Share</small></button><button type="button" class="short-audio-cover short-audio-btn" aria-label="Original audio">♫</button><div class="short-more-menu-wrapper"><button type="button" class="short-action short-more-btn" aria-label="More options" aria-haspopup="menu" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="19" cy="12" r="1.8"></circle></svg></button><div class="short-dropdown-menu hidden" role="menu"><button type="button" class="short-dropdown-item short-bookmark-btn" role="menuitem">${video.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}</button>${canDelete ? '<button type="button" class="short-dropdown-item short-delete-btn danger" role="menuitem">Delete</button>' : ''}</div></div></div></div></article></section>`;
        }).join('');

        const pages = [...stage.querySelectorAll('.short-video-page')];
        pages.forEach((page, index) => {
            const video = videos[index];
            const author = video.author || video.user || {};
            const avatarUrl = author.avatar_url || video.author_avatar || '';
            const card = page.querySelector('.short-card');
            const media = page.querySelector('.short-video-media');
            const togglePlayback = () => toggleMediaPlayback(page, media);
            card.addEventListener('click', (event) => {
                if (!(event.target instanceof Element) || event.target.closest('.short-interactions, .short-card-copy, .short-subscribe')) return;
                if (tapTimer) {
                    window.clearTimeout(tapTimer);
                    tapTimer = 0;
                    if (tapPage === page) {
                        tapPage = null;
                        page.querySelector('.short-like-btn')?.click();
                        return;
                    }
                }
                tapPage = page;
                tapTimer = window.setTimeout(() => {
                    tapTimer = 0;
                    tapPage = null;
                    togglePlayback();
                }, 240);
            });
            page.querySelector('.short-more-btn')?.addEventListener('click', (event) => {
                event.stopPropagation();
                const button = event.currentTarget;
                const menu = page.querySelector('.short-dropdown-menu');
                const shouldOpen = menu.classList.contains('hidden');
                document.querySelectorAll('.short-dropdown-menu:not(.hidden)').forEach((openMenu) => {
                    openMenu.classList.add('hidden');
                    openMenu.parentElement.querySelector('.short-more-btn')?.setAttribute('aria-expanded', 'false');
                });
                menu.classList.toggle('hidden', !shouldOpen);
                button.setAttribute('aria-expanded', String(shouldOpen));
            });
            page.querySelector('.short-bookmark-btn')?.addEventListener('click', async (event) => {
                event.stopPropagation();
                const button = event.currentTarget;
                button.disabled = true;
                try {
                    if (!window.requireAuth?.(null, 'Please sign in before saving a video.')) return;
                    const response = await fetch(`${apiBase}/shorts/${video.id}/bookmark`, { method: 'POST', headers: authHeaders() });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'Unable to update video bookmark');
                    video.is_bookmarked = Boolean(result.bookmarked);
                    button.textContent = video.is_bookmarked ? 'Remove bookmark' : 'Bookmark';
                    showShortNotice(video.is_bookmarked ? 'Saved to bookmarks' : 'Removed from bookmarks', 'success');
                } catch (error) {
                    showShortNotice(error.message || 'Unable to update video bookmark', 'error');
                } finally {
                    button.disabled = false;
                    page.querySelector('.short-dropdown-menu')?.classList.add('hidden');
                    page.querySelector('.short-more-btn')?.setAttribute('aria-expanded', 'false');
                }
            });
            page.querySelector('.short-delete-btn')?.addEventListener('click', async (event) => {
                event.stopPropagation();
                page.querySelector('.short-dropdown-menu')?.classList.add('hidden');
                page.querySelector('.short-more-btn')?.setAttribute('aria-expanded', 'false');
                const translate = (key) => window.AeroI18n?.t(key) || key;
                const confirmModal = window.confirmModal;
                if (typeof confirmModal !== 'function') {
                    showShortNotice('Unable to open the delete confirmation dialog', 'error');
                    return;
                }
                const confirmed = await confirmModal({
                    title: translate('deleteVideoTitle'),
                    description: translate('deleteVideoConfirm'),
                    confirmLabel: translate('Delete'),
                    cancelLabel: translate('Cancel'),
                    danger: true,
                });
                if (!confirmed) return;
                const button = event.currentTarget;
                button.disabled = true;
                try {
                    const response = await fetch(`${apiBase}/shorts/${video.id}`, { method: 'DELETE', headers: authHeaders() });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(result.message || 'Unable to delete video');
                    toggleShortsComments(false);
                    videos.splice(index, 1);
                    currentIndex = videos.length
                        ? Math.min(currentIndex > index ? currentIndex - 1 : currentIndex, videos.length - 1)
                        : 0;
                    renderCurrentVideo();
                    showShortNotice('Video deleted', 'success');
                } catch (error) {
                    showShortNotice(error.message || 'Unable to delete video', 'error');
                    button.disabled = false;
                }
            });
            page.querySelector('.short-subscribe')?.addEventListener('click', async (event) => {
                const button = event.currentTarget;
                if (!button.dataset.userId) return;
                button.disabled = true;
                try {
                    const response = await fetch(`${apiBase}/users/${button.dataset.userId}/follow`, { method: 'POST', headers: authHeaders() });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'Unable to update subscription');
                    const isFollowing = Boolean(result.is_following);
                    const followedUserId = Number(button.dataset.userId);
                    videos.forEach((item) => {
                        const itemAuthorId = Number(item.authorId ?? item.author?.id ?? item.user?.id);
                        if (itemAuthorId === followedUserId) item.is_following = isFollowing;
                    });
                    document.querySelectorAll('.short-subscribe').forEach((subscribeButton) => {
                        if (Number(subscribeButton.dataset.userId) !== followedUserId) return;
                        subscribeButton.textContent = isFollowing ? 'Subscribed' : 'Subscribe';
                        subscribeButton.classList.toggle('subscribed', isFollowing);
                    });
                    if (result.is_following) window.addContactToChatList?.({ id: Number(button.dataset.userId), name: author.username || 'User', username: author.username || 'User', avatar: avatarUrl });
                } catch (error) {
                    showShortNotice(error.message || 'Unable to update subscription', 'error');
                } finally {
                    button.disabled = false;
                }
            });
            page.querySelector('.short-like-btn')?.addEventListener('click', async (event) => {
                const button = event.currentTarget;
                button.disabled = true;
                try {
                    const response = await fetch(`${apiBase}/shorts/${video.id}/like`, { method: 'POST', headers: authHeaders() });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'Unable to update like');
                    video.is_liked = result.liked;
                    video.likes_count = result.likes_count;
                    button.classList.toggle('is-liked', result.liked);
                    button.setAttribute('aria-pressed', String(result.liked));
                    button.querySelector('small').textContent = result.likes_count;
                } catch (error) {
                    showShortNotice(error.message || 'Unable to update like', 'error');
                } finally {
                    button.disabled = false;
                }
            });
            page.querySelector('.short-share-btn')?.addEventListener('click', async () => {
                try {
                    if (navigator.share) await navigator.share({ title: 'Aero Short', text: video.caption || 'Watch this Short', url: window.location.href });
                    else if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(window.location.href);
                        showShortNotice('Link copied to clipboard!', 'success');
                    } else throw new Error('Sharing is not available in this browser');
                } catch (error) {
                    if (error.name !== 'AbortError') showShortNotice(error.message || 'Unable to share this Short', 'error');
                }
            });
            page.querySelector('.short-comment-btn')?.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const drawer = document.getElementById('shorts-comment-drawer');
                const wasOpen = drawer?.classList.contains('open');
                toggleShortsComments(true, drawer);
                event.currentTarget.setAttribute('aria-expanded', 'true');
                if (!wasOpen) openShortComments(video.id);
            });
            page.querySelector('.short-audio-btn')?.addEventListener('click', () => showShortNotice(`Original audio: ${video.track_name || 'Original audio'}`));
            card?.addEventListener('animationend', () => card.classList.remove('is-entering-from-next', 'is-entering-from-previous'));
        });

        shortObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const media = entry.target.querySelector('.short-video-media');
                if (!media) return;
                if (entry.intersectionRatio >= 0.8) {
                    currentIndex = Number(entry.target.dataset.shortIndex) || 0;
                    activeMedia = media;
                    media.muted = true;
                    media.play().catch(() => {});
                } else {
                    media.pause();
                    if (activeMedia === media) activeMedia = null;
                }
            });
        }, { root: stage, threshold: [0, 0.8, 1] });
        pages.forEach((page) => shortObserver.observe(page));
        stage.scrollTop = currentIndex * stage.clientHeight;
    }

    function changeVideo(direction) {
        const stage = document.getElementById('shorts-stage');
        const nextIndex = currentIndex + direction;
        const nextPage = stage?.querySelector(`[data-short-index="${nextIndex}"]`);
        if (!stage || !nextPage || isChangingVideo) return;
        isChangingVideo = true;
        window.clearTimeout(videoChangeTimeout);
        videoChangeTimeout = window.setTimeout(() => {
            isChangingVideo = false;
            videoChangeTimeout = 0;
        }, 700);
        toggleShortsComments(false);
        nextPage.querySelector('.short-card')?.classList.add(direction > 0 ? 'is-entering-from-next' : 'is-entering-from-previous');
        stage.scrollTo({ top: nextPage.offsetTop, behavior: 'smooth' });
    }

    async function loadShorts() {
        const response = await fetch(`${apiBase}/shorts`, { headers: authHeaders() });
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload.message || 'Unable to load Shorts');
        videos = Array.isArray(payload) ? payload : [];
        currentIndex = Math.max(0, Math.min(currentIndex, Math.max(videos.length - 1, 0)));
        renderCurrentVideo();
    }

    async function uploadShort(file, caption = '') {
        const formData = new FormData();
        formData.append('file', file);
        const uploadResponse = await fetch(`${apiBase}/shorts/upload`, { method: 'POST', headers: authHeaders(), body: formData });
        const uploadText = await uploadResponse.text();
        let upload;
        try { upload = JSON.parse(uploadText); } catch { throw new Error(`Upload failed (${uploadResponse.status})`); }
        if (!uploadResponse.ok || upload.success !== true) throw new Error(upload.message || 'Upload failed');
        const createResponse = await fetch(`${apiBase}/videos`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ video_url: upload.video_url, caption }) });
        const createText = await createResponse.text();
        let created;
        try { created = JSON.parse(createText); } catch { throw new Error(`Unable to publish Short video (${createResponse.status})`); }
        if (!createResponse.ok) throw new Error(created.message || 'Unable to publish Short video');
        await loadShorts();
    }

    async function openShortComments(videoId) {
        const drawer = document.getElementById('shorts-comment-drawer') || document.getElementById('short-comments-drawer');
        const list = document.getElementById('shorts-comment-list') || document.getElementById('short-comments-list');
        const form = document.getElementById('shorts-comment-form') || document.getElementById('short-comment-form');
        const input = document.getElementById('shorts-comment-input') || document.getElementById('short-comment-input');
        if (!drawer || !list || !form || !input) return;
        list.innerHTML = `<div class="shorts-empty">${window.AeroI18n?.t('loading_comments') || 'Loading comments...'}</div>`;
        try {
            const response = await fetch(`${apiBase}/shorts/${videoId}/comments`, { headers: authHeaders() });
            const comments = await response.json();
            if (!response.ok) throw new Error(comments.message || 'Unable to load comments');
            list.innerHTML = (comments || []).map((comment) => {
                const gif = parseGifContent(comment.content, comment.media_url, comment.type);
                const username = comment.username || 'User';
                const avatarUrl = window.AeroAvatar?.getUrl({ id: comment.user_id, username, avatar_url: comment.avatar_url }) || (comment.avatar_url ? mediaUrl(comment.avatar_url) : '');
                const avatar = `<span class="short-comment-avatar" data-user-id="${escapeText(comment.user_id || '')}" data-fallback="${escapeText(username.charAt(0).toUpperCase())}">${avatarUrl ? `<img src="${escapeText(avatarUrl)}" alt="" loading="lazy" decoding="async">` : escapeText(username.charAt(0).toUpperCase())}</span>`;
                return `<article class="short-comment" data-comment-user-id="${escapeText(comment.user_id || '')}">${avatar}<div class="short-comment-body"><div class="short-comment-meta"><strong>@${escapeText(username)}</strong><time datetime="${escapeText(comment.created_at || '')}">${escapeText(relativeTime(comment.created_at))}</time></div>${gif.text ? `<p>${escapeText(gif.text)}</p>` : ''}${gif.url ? `<img src="${escapeText(gif.url)}" class="comment-gif" alt="GIF" loading="lazy">` : ''}<div class="short-comment-actions"><button type="button" class="short-comment-like ${comment.is_liked ? 'is-liked' : ''}" data-comment-like="${escapeText(comment.id)}" aria-label="Like comment" aria-pressed="${Boolean(comment.is_liked)}">♥ <span>${Number(comment.likes_count) || 0}</span></button><button type="button" data-reply-user="${escapeText(username)}">Reply</button></div></div></article>`;
            }).join('') || `<div class="shorts-empty">${window.AeroI18n?.t('no_comments') || 'No comments yet.'}</div>`;
            list.querySelectorAll('.short-comment-avatar img').forEach((image) => {
                image.addEventListener('error', () => {
                    const avatar = image.parentElement;
                    if (!avatar) return;
                    avatar.textContent = avatar.dataset.fallback || 'U';
                    avatar.classList.remove('has-image');
                }, { once: true });
            });
        } catch (error) {
            list.innerHTML = `<div class="shorts-empty">${escapeText(error.message || 'Unable to load comments')}</div>`;
            return;
        }
        list.onclick = async (event) => {
            const likeButton = event.target.closest('[data-comment-like]');
            if (likeButton) {
                likeButton.disabled = true;
                try {
                    const response = await fetch(`${apiBase}/shorts/comments/${likeButton.dataset.commentLike}/like`, { method: 'POST', headers: authHeaders() });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.message || 'Unable to update comment like');
                    likeButton.classList.toggle('is-liked', result.liked);
                    likeButton.setAttribute('aria-pressed', String(result.liked));
                    likeButton.querySelector('span').textContent = result.likes_count;
                } catch (error) {
                    showShortNotice(error.message || 'Unable to update comment like', 'error');
                } finally {
                    likeButton.disabled = false;
                }
                return;
            }
            const replyButton = event.target.closest('[data-reply-user]');
            if (!replyButton) return;
            input.value = `@${replyButton.dataset.replyUser} `;
            input.focus();
        };
        form.onsubmit = async (event) => {
            event.preventDefault();
            const value = input.value.trim();
            if (!value) return;
            const gifUrl = extractGifUrl(value);
            const submitButton = form.querySelector('[type="submit"]');
            submitButton.disabled = true;
            try {
                const response = await fetch(`${apiBase}/shorts/${videoId}/comments`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ content: gifUrl ? value.replace(gifUrl, '').trim() : value, media_url: gifUrl, type: gifUrl ? 'gif' : 'text' }) });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Unable to post comment');
                input.value = '';
                await openShortComments(videoId);
            } catch (error) {
                showShortNotice(error.message || 'Unable to post comment', 'error');
            } finally {
                submitButton.disabled = false;
            }
        };
    }

    function toggleShortsComments(show, drawer = document.getElementById('shorts-comment-drawer') || document.getElementById('short-comments-drawer')) {
        const backdrop = document.getElementById('shorts-comments-backdrop');
        if (!drawer) return;
        const container = drawer.closest('.shorts-container');
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        window.clearTimeout(shortsCommentsCloseTimer);
        if (shortsCommentsAnimationEnd) {
            drawer.removeEventListener('animationend', shortsCommentsAnimationEnd);
            shortsCommentsAnimationEnd = null;
        }
        if (show) {
            const cardStartLeft = !isMobile ? container?.querySelector('.short-card')?.getBoundingClientRect().left : null;
            drawer.classList.remove('hidden', 'closing');
            drawer.classList.add('open');
            container?.classList.add('comments-open');
            if (cardStartLeft !== null && cardStartLeft !== undefined) {
                window.requestAnimationFrame(() => {
                    if (drawer.classList.contains('open')) animateShortCardShift(container, cardStartLeft);
                });
            }
        } else if (!drawer.classList.contains('hidden')) {
            drawer.classList.remove('open');
            drawer.classList.add('closing');
            const finishClose = () => {
                if (!drawer.classList.contains('closing')) return;
                const cardStartLeft = !isMobile ? container?.querySelector('.short-card')?.getBoundingClientRect().left : null;
                drawer.classList.remove('closing');
                drawer.classList.add('hidden');
                container?.classList.remove('comments-open');
                if (cardStartLeft !== null && cardStartLeft !== undefined) {
                    window.requestAnimationFrame(() => animateShortCardShift(container, cardStartLeft));
                }
                if (shortsCommentsAnimationEnd) {
                    drawer.removeEventListener('animationend', shortsCommentsAnimationEnd);
                    shortsCommentsAnimationEnd = null;
                }
                window.clearTimeout(shortsCommentsCloseTimer);
                shortsCommentsCloseTimer = 0;
            };
            shortsCommentsAnimationEnd = (event) => {
                if (event.target === drawer && ['shortsCommentDrawerOut', 'shortsCommentDrawerSideOut'].includes(event.animationName)) finishClose();
            };
            drawer.addEventListener('animationend', shortsCommentsAnimationEnd);
            shortsCommentsCloseTimer = window.setTimeout(finishClose, 450);
        } else {
            drawer.classList.remove('open', 'closing');
            drawer.classList.add('hidden');
            container?.classList.remove('comments-open');
        }
        document.getElementById('short-comment-btn')?.setAttribute('aria-expanded', String(show));
        backdrop?.classList.toggle('hidden', !show);
        backdrop?.classList.toggle('active', show);
        document.body.style.overflow = show && isMobile ? 'hidden' : '';
    }

    window.toggleShortsComments = toggleShortsComments;

    window.openVideoUploadModal = () => {
        if (!document.getElementById('threads-compose-overlay')?.classList.contains('hidden')) {
            window.closeThreadsCompose?.(true);
        }
        document.getElementById('short-upload-modal')?.classList.remove('hidden');
    };
    window.closeVideoUploadModal = () => document.getElementById('short-upload-modal')?.classList.add('hidden');
    window.cleanupShortsPlayback = () => {
        shortObserver?.disconnect();
        shortObserver = null;
        activeMedia?.pause();
        activeMedia = null;
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('aero:view-change', (event) => { if (event.detail.view === 'shorts') loadShorts(); });
        document.addEventListener('click', (event) => {
            if (!(event.target instanceof Element) || event.target.closest('.short-more-menu-wrapper')) return;
            document.querySelectorAll('.short-dropdown-menu:not(.hidden)').forEach((menu) => {
                menu.classList.add('hidden');
                menu.parentElement.querySelector('.short-more-btn')?.setAttribute('aria-expanded', 'false');
            });
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                document.querySelectorAll('.short-dropdown-menu:not(.hidden)').forEach((menu) => {
                    menu.classList.add('hidden');
                    menu.parentElement.querySelector('.short-more-btn')?.setAttribute('aria-expanded', 'false');
                });
                return;
            }
            if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
            const activeElement = document.activeElement;
            if (activeElement instanceof HTMLElement && (
                activeElement.isContentEditable ||
                ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(activeElement.tagName) ||
                activeElement.closest('[role="button"], [contenteditable="true"]')
            )) return;
            if (document.querySelector('#short-upload-modal:not(.hidden), #threads-compose-overlay:not(.hidden)')) return;
            if (document.getElementById('view-shorts')?.classList.contains('hidden')) return;
            const media = activeMedia || document.querySelector(`#shorts-stage [data-short-index="${currentIndex}"] .short-video-media`);
            if (!media) return;
            event.preventDefault();
            const page = media.closest('.short-video-page');
            if (page) toggleMediaPlayback(page, media);
        });
        document.addEventListener('click', (event) => {
            if (event.target.closest('#shorts-empty-upload')) window.openVideoUploadModal();
        });
        const shortsStage = document.getElementById('shorts-stage');
        shortsStage?.addEventListener('wheel', (event) => {
            if (Math.abs(event.deltaY) <= 20) return;
            event.preventDefault();
            changeVideo(event.deltaY > 0 ? 1 : -1);
        }, { passive: false });
        shortsStage?.addEventListener('scroll', () => {
            if (!isChangingVideo) return;
            window.clearTimeout(videoChangeTimeout);
            videoChangeTimeout = window.setTimeout(() => {
                isChangingVideo = false;
                videoChangeTimeout = 0;
            }, 140);
        }, { passive: true });
        document.addEventListener('click', (event) => {
            const drawer = document.getElementById('shorts-comment-drawer');
            const target = event.target;
            if (!drawer?.classList.contains('open') || !(target instanceof Element)) return;
            if (drawer.contains(target) || target.closest('.short-comment-btn')) return;
            toggleShortsComments(false, drawer);
        });
        document.addEventListener('keydown', (event) => {
            if (document.getElementById('view-shorts')?.classList.contains('hidden') || event.repeat) return;
            const target = event.target;
            if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            changeVideo(event.key === 'ArrowDown' ? 1 : -1);
        });
        document.querySelector('.comment-drawer-close')?.addEventListener('click', () => {
            toggleShortsComments(false, document.getElementById('shorts-comment-drawer'));
        });
        document.getElementById('close-short-comments')?.addEventListener('click', () => {
            toggleShortsComments(false, document.getElementById('short-comments-drawer'));
        });
        document.getElementById('shorts-comments-backdrop')?.addEventListener('click', () => toggleShortsComments(false));
        let commentTouchStartY = 0;
        let commentTouchDrawer = null;
        document.addEventListener('touchstart', (event) => {
            const drawer = document.getElementById('shorts-comment-drawer');
            if (!drawer || drawer.classList.contains('hidden') || !event.target.closest('.comment-drawer-handle')) return;
            commentTouchStartY = event.touches[0]?.clientY || 0;
            commentTouchDrawer = drawer;
        }, { passive: true });
        document.addEventListener('touchend', (event) => {
            const drawer = commentTouchDrawer;
            if (!drawer || drawer.classList.contains('hidden') || !commentTouchStartY) return;
            const distance = (event.changedTouches[0]?.clientY || 0) - commentTouchStartY;
            if (distance > 80) toggleShortsComments(false, drawer);
            commentTouchStartY = 0;
            commentTouchDrawer = null;
        }, { passive: true });
        document.addEventListener('touchcancel', () => {
            commentTouchStartY = 0;
            commentTouchDrawer = null;
        }, { passive: true });
        const uploadModal = document.getElementById('short-upload-modal');
        const fileInput = document.getElementById('short-upload-file');
        const dropzone = document.getElementById('video-dropzone');
        const fileDetails = document.getElementById('video-file-details');
        const setSelectedFile = (file) => {
            if (!file || !file.type.startsWith('video/')) return;
            const transfer = new DataTransfer();
            transfer.items.add(file);
            fileInput.files = transfer.files;
            fileDetails.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
            dropzone.classList.add('has-file');
        };
        dropzone?.addEventListener('click', () => fileInput?.click());
        dropzone?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput?.click(); } });
        dropzone?.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); });
        dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragging'));
        dropzone?.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); setSelectedFile(event.dataTransfer.files?.[0]); });
        fileInput?.addEventListener('change', () => setSelectedFile(fileInput.files?.[0]));
        document.getElementById('close-short-upload')?.addEventListener('click', () => uploadModal?.classList.add('hidden'));
        uploadModal?.addEventListener('click', (event) => { if (event.target === uploadModal) uploadModal.classList.add('hidden'); });
        document.getElementById('short-upload-form')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const fileInput = document.getElementById('short-upload-file');
            const file = fileInput.files?.[0];
            if (!file) return;
            try {
                await uploadShort(file, document.getElementById('short-upload-caption').value.trim());
                document.getElementById('short-upload-modal').classList.add('hidden');
                event.target.reset();
                dropzone?.classList.remove('has-file');
                if (fileDetails) fileDetails.textContent = '';
            } catch (error) { window.alert(error.message); }
        });
    });
})();
