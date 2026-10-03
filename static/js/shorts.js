// Short-video feed and video interaction controller
// From: index.html shorts view -> To: /api/video endpoints and video tables
(() => {
    const apiBase = window.AeroConfig.API_BASE_URL;
    let videos = [];
    let currentIndex = 0;
    let activeMedia = null;
    let shortObserver = null;
    let tapTimer = 0;
    let touchStartY = 0;
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

    function renderCurrentVideo(direction = 0) {
        const stage = document.getElementById('shorts-stage');
        const video = videos[currentIndex];
        activeMedia?.pause();
        if (!stage || !video) {
            if (stage) stage.innerHTML = `<div class="shorts-empty"><div class="shorts-empty-content"><span>${window.AeroI18n?.t('no_shorts') || 'No Shorts available yet.'}</span><button type="button" id="shorts-empty-upload" class="shorts-empty-upload">${window.AeroI18n?.t('upload_first_video') || '+ Upload First Video'}</button></div></div>`;
            return;
        }
        const author = video.author || video.user || {};
        const avatarUrl = author.avatar_url || video.author_avatar || '';
        const videoSourceType = /\.mov(?:$|\?)/i.test(video.video_url) ? 'video/quicktime' : /\.webm(?:$|\?)/i.test(video.video_url) ? 'video/webm' : /\.m4v(?:$|\?)/i.test(video.video_url) ? 'video/x-m4v' : 'video/mp4';
        const avatar = window.AeroAvatar?.markup({ ...author, avatar_url: avatarUrl }, 'short-author-avatar') || (avatarUrl ? `<img src="${escapeText(mediaUrl(avatarUrl))}" alt="" loading="lazy" decoding="async">` : escapeText((author.username || 'U').charAt(0).toUpperCase()));
        stage.innerHTML = `<article class="short-card"><video id="active-short-video" playsinline loop autoplay preload="metadata" data-hdr-fallback="${!window.AeroMediaCapabilities?.isHDRSupported()}"><source src="${escapeText(mediaUrl(video.video_url))}" type="${videoSourceType}"></video><span class="short-playback-indicator" aria-hidden="true"></span><div class="short-card-overlay"><div class="short-card-copy"><div class="short-author">${avatar}<strong>@${escapeText(author.username || 'User')}</strong><button type="button" class="short-subscribe ${video.is_following ? 'subscribed' : ''}" data-user-id="${author.id || ''}">${video.is_following ? 'Subscribed' : 'Subscribe'}</button></div><p>${escapeText(video.caption)}</p><div class="short-track">♫ <span>${escapeText(video.track_name || 'Original audio')}</span></div></div><div class="short-interactions"><button type="button" id="short-like-btn" class="short-action ${video.is_liked ? 'is-liked' : ''}" aria-label="Like" aria-pressed="${Boolean(video.is_liked)}">${icon('heart')}<small>${video.likes_count || 0}</small></button><button type="button" id="short-comment-btn" class="short-action" aria-label="Comments" aria-expanded="false">${icon('comment')}<small>Comments</small></button><button type="button" id="short-share-btn" class="short-action" aria-label="Share">${icon('share')}<small>Share</small></button><button type="button" id="short-audio-btn" class="short-audio-cover" aria-label="Original audio">♫</button></div></div><div class="short-nav"><button type="button" id="short-prev" aria-label="Previous Short">↑</button><button type="button" id="short-next" aria-label="Next Short">↓</button></div></article>`;
        const card = stage.querySelector('.short-card');
        if (direction) card?.classList.add(direction > 0 ? 'is-entering-from-next' : 'is-entering-from-previous');
        const media = document.getElementById('active-short-video');
        activeMedia = media;
        media.muted = false;
        media.autoplay = false;
        media.pause();
        const togglePlayback = () => {
            const indicator = stage.querySelector('.short-playback-indicator');
            if (media.paused) {
                media.play().catch(() => {});
                indicator.textContent = '▶';
            } else {
                media.pause();
                indicator.textContent = '❚❚';
            }
            indicator.classList.remove('is-visible');
            void indicator.offsetWidth;
            indicator.classList.add('is-visible');
        };
        media.addEventListener('click', () => {
            if (tapTimer) {
                window.clearTimeout(tapTimer);
                tapTimer = 0;
                stage.querySelector('#short-like-btn')?.click();
                return;
            }
            tapTimer = window.setTimeout(() => {
                tapTimer = 0;
                togglePlayback();
            }, 240);
        });
        stage.querySelector('.short-subscribe')?.addEventListener('click', async (event) => {
            const button = event.currentTarget;
            if (!button.dataset.userId) return;
            button.disabled = true;
            try {
                const response = await fetch(`${apiBase}/users/${button.dataset.userId}/follow`, { method: 'POST', headers: authHeaders() });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || 'Unable to update subscription');
                button.textContent = result.is_following ? 'Subscribed' : 'Subscribe';
                button.classList.toggle('subscribed', result.is_following);
                video.is_following = result.is_following;
                if (result.is_following) {
                    window.addContactToChatList?.({
                        id: Number(button.dataset.userId),
                        name: (author.username || 'User'),
                        username: (author.username || 'User'),
                        avatar: avatarUrl
                    });
                }
            } catch (error) {
                showShortNotice(error.message || 'Unable to update subscription', 'error');
            } finally {
                button.disabled = false;
            }
        });
        stage.querySelector('#short-prev')?.setAttribute('title', 'Previous Short');
        stage.querySelector('#short-next')?.setAttribute('title', 'Next Short');
        stage.querySelector('#short-prev')?.addEventListener('click', () => changeVideo(-1));
        stage.querySelector('#short-next')?.addEventListener('click', () => changeVideo(1));
        stage.querySelector('#short-like-btn')?.addEventListener('click', async (event) => {
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
        stage.querySelector('#short-share-btn')?.addEventListener('click', async () => {
            try {
                if (navigator.share) {
                    await navigator.share({ title: 'Aero Short', text: video.caption || 'Watch this Short', url: window.location.href });
                } else if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(window.location.href);
                    showShortNotice('Link copied to clipboard!', 'success');
                } else {
                    throw new Error('Sharing is not available in this browser');
                }
            } catch (error) {
                if (error.name !== 'AbortError') showShortNotice(error.message || 'Unable to share this Short', 'error');
            }
        });
        stage.querySelector('#short-comment-btn')?.addEventListener('click', (event) => {
            const drawer = document.getElementById('shorts-comment-drawer');
            const isOpen = drawer?.classList.contains('open');
            toggleShortsComments(!isOpen, drawer);
            event.currentTarget.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) openShortComments(video.id);
        });
        stage.querySelector('#short-audio-btn')?.addEventListener('click', () => {
            showShortNotice(`Original audio: ${video.track_name || 'Original audio'}`);
        });
        shortObserver?.disconnect();
        shortObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.intersectionRatio >= 0.8) {
                    activeMedia = media;
                    media.muted = false;
                    media.play().catch(() => { media.muted = true; media.play().catch(() => {}); });
                } else {
                    media.pause();
                    media.currentTime = 0;
                }
            });
        }, { threshold: [0, 0.8, 1] });
        if (card) shortObserver.observe(card);
    }

    function changeVideo(direction) {
        if (!videos.length || isChangingVideo) return;
        isChangingVideo = true;
        window.clearTimeout(videoChangeTimeout);
        videoChangeTimeout = window.setTimeout(() => {
            isChangingVideo = false;
            videoChangeTimeout = 0;
        }, 380);
        toggleShortsComments(false);
        currentIndex = (currentIndex + direction + videos.length) % videos.length;
        renderCurrentVideo(direction);
        document.getElementById('shorts-stage')?.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setupTouchFallback(stage) {
        stage.addEventListener('touchstart', (event) => {
            touchStartY = event.touches[0]?.clientY || 0;
        }, { passive: true });
        stage.addEventListener('touchend', (event) => {
            if (!touchStartY) return;
            const deltaY = (event.changedTouches[0]?.clientY || 0) - touchStartY;
            touchStartY = 0;
            if (Math.abs(deltaY) <= 50) return;
            changeVideo(deltaY < 0 ? 1 : -1);
        }, { passive: true });
    }

    async function loadShorts() {
        const response = await fetch(`${apiBase}/shorts`, { headers: authHeaders() });
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload.message || 'Unable to load Shorts');
        videos = Array.isArray(payload) ? payload : [];
        currentIndex = Math.min(currentIndex, Math.max(videos.length - 1, 0));
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

    window.openVideoUploadModal = () => document.getElementById('short-upload-modal')?.classList.remove('hidden');
    window.cleanupShortsPlayback = () => {
        shortObserver?.disconnect();
        shortObserver = null;
        activeMedia?.pause();
        activeMedia = null;
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('aero:view-change', (event) => { if (event.detail.view === 'shorts') loadShorts(); });
        document.addEventListener('click', (event) => {
            if (event.target.closest('#shorts-empty-upload')) window.openVideoUploadModal();
        });
        const shortsStage = document.getElementById('shorts-stage');
        shortsStage && setupTouchFallback(shortsStage);
        shortsStage?.addEventListener('wheel', (event) => {
            if (Math.abs(event.deltaY) <= 20) return;
            event.preventDefault();
            changeVideo(event.deltaY > 0 ? 1 : -1);
        }, { passive: false });
        document.addEventListener('click', (event) => {
            const drawer = document.getElementById('shorts-comment-drawer');
            const target = event.target;
            if (!drawer?.classList.contains('open') || !(target instanceof Element)) return;
            if (drawer.contains(target) || target.closest('#short-comment-btn')) return;
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
