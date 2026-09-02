(() => {
    const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000/api' : `${window.location.origin}/api`;
    let videos = [];
    let currentIndex = 0;
    let activeMedia = null;

    const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` });
    const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const parseGifContent = (content, mediaUrl = '', type = '') => {
        const match = String(content || '').match(/https?:\/\/[^\s<>"']+(?:\.gif(?:\?[^\s<>"']*)?|(?:media|i)\.giphy\.com|tenor\.com[^\s<>"']*)/i);
        const url = mediaUrl || (String(type).toLowerCase() === 'gif' ? match?.[0] : match?.[0]);
        return url ? { url, text: String(content || '').replace(url, '').replace('[GIF]', '').trim() } : { url: '', text: String(content || '') };
    };
    const extractGifUrl = (content) => parseGifContent(content).url;
    const mediaUrl = (url) => String(url || '').startsWith('http') ? url : `${apiBase.replace(/\/api$/, '')}${url}`;
    const icon = (name) => ({
        heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.5-8.8 10.2-8.8 10.2S3.2 14.3 3.2 8.8A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"></path></svg>',
        comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.5-.7L4 20l1.7-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"></path></svg>',
        share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 7 7-7 7M21 12H4"></path></svg>',
    })[name];

    function renderCurrentVideo() {
        const stage = document.getElementById('shorts-stage');
        const video = videos[currentIndex];
        activeMedia?.pause();
        if (!stage || !video) {
            if (stage) stage.innerHTML = '<div class="shorts-empty"><div class="shorts-empty-content"><span>No Shorts available yet.</span><button type="button" id="shorts-empty-upload" class="shorts-empty-upload">+ Upload First Video</button></div></div>';
            return;
        }
        const author = video.author || video.user || {};
        const avatarUrl = author.avatar_url || video.author_avatar || '';
        const avatar = avatarUrl ? `<img src="${escapeText(mediaUrl(avatarUrl))}" alt="">` : escapeText((author.username || 'U').charAt(0).toUpperCase());
        stage.innerHTML = `<article class="short-card"><video id="active-short-video" src="${escapeText(mediaUrl(video.video_url))}" playsinline loop autoplay></video><span class="short-playback-indicator" aria-hidden="true"></span><div class="short-card-overlay"><div class="short-card-copy"><div class="short-author"><span class="short-author-avatar">${avatar}</span><strong>@${escapeText(author.username || 'User')}</strong><button type="button" class="short-subscribe ${video.is_following ? 'subscribed' : ''}" data-user-id="${author.id || ''}">${video.is_following ? 'Subscribed' : 'Subscribe'}</button></div><p>${escapeText(video.caption)}</p><div class="short-track">♫ <span>${escapeText(video.track_name || 'Original audio')}</span></div></div><div class="short-interactions"><button type="button" id="short-like-btn" class="short-action ${video.is_liked ? 'is-liked' : ''}" aria-label="Like" aria-pressed="${Boolean(video.is_liked)}">${icon('heart')}<small>${video.likes_count || 0}</small></button><button type="button" id="short-comment-btn" class="short-action" aria-label="Comments">${icon('comment')}<small>Comments</small></button><button type="button" id="short-share-btn" class="short-action" aria-label="Share">${icon('share')}<small>Share</small></button><span class="short-audio-cover">♫</span></div></div><div class="short-nav"><button type="button" id="short-prev" aria-label="Previous Short">↑</button><button type="button" id="short-next" aria-label="Next Short">↓</button></div></article>`;
        const media = document.getElementById('active-short-video');
        activeMedia = media;
        media.muted = false;
        media.play().catch(() => { media.muted = true; media.play().catch(() => {}); });
        media.addEventListener('click', () => {
            const indicator = stage.querySelector('.short-playback-indicator');
            if (media.paused) {
                media.play();
                indicator.textContent = '▶';
            } else {
                media.pause();
                indicator.textContent = '❚❚';
            }
            indicator.classList.remove('is-visible');
            void indicator.offsetWidth;
            indicator.classList.add('is-visible');
        });
        stage.querySelector('.short-subscribe')?.addEventListener('click', async (event) => {
            const button = event.currentTarget;
            if (!button.dataset.userId) return;
            const response = await fetch(`${apiBase}/users/${button.dataset.userId}/follow`, { method: 'POST', headers: authHeaders() });
            const result = await response.json();
            if (response.ok) {
                button.textContent = result.is_following ? 'Subscribed' : 'Subscribe';
                button.classList.toggle('subscribed', result.is_following);
                if (result.is_following) {
                    window.addContactToChatList?.({
                        id: Number(button.dataset.userId),
                        name: (author.username || 'User'),
                        username: (author.username || 'User'),
                        avatar: avatarUrl
                    });
                }
            }
        });
        stage.querySelector('#short-prev')?.addEventListener('click', () => changeVideo(-1));
        stage.querySelector('#short-next')?.addEventListener('click', () => changeVideo(1));
        stage.querySelector('#short-like-btn')?.addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const response = await fetch(`${apiBase}/shorts/${video.id}/like`, { method: 'POST', headers: authHeaders() });
            const result = await response.json();
            if (response.ok) { button.classList.toggle('is-liked', result.liked); button.setAttribute('aria-pressed', result.liked); button.querySelector('small').textContent = result.likes_count; }
        });
        stage.querySelector('#short-share-btn')?.addEventListener('click', async () => {
            await navigator.clipboard?.writeText(window.location.href);
            if (typeof showNotice === 'function') showNotice('Link copied to clipboard!', 'success');
        });
        stage.querySelector('#short-comment-btn')?.addEventListener('click', () => openShortComments(video.id));
    }

    function changeVideo(direction) {
        if (!videos.length) return;
        currentIndex = (currentIndex + direction + videos.length) % videos.length;
        renderCurrentVideo();
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
        drawer.classList.remove('hidden');
        drawer.closest('.shorts-container')?.classList.add('comments-open');
        list.innerHTML = '<div class="shorts-empty">Loading comments...</div>';
        const response = await fetch(`${apiBase}/shorts/${videoId}/comments`, { headers: authHeaders() });
        const comments = await response.json();
        list.innerHTML = (comments || []).map((comment) => {
            const gif = parseGifContent(comment.content, comment.media_url, comment.type);
            return `<div class="short-comment"><strong>@${escapeText(comment.username)}</strong>${gif.text ? `<span>${escapeText(gif.text)}</span>` : ''}${gif.url ? `<img src="${escapeText(gif.url)}" class="comment-gif" alt="GIF" loading="lazy">` : ''}</div>`;
        }).join('') || '<div class="shorts-empty">No comments yet.</div>';
        form.onsubmit = async (event) => {
            event.preventDefault();
            const value = input.value.trim();
            if (!value) return;
            const gifUrl = extractGifUrl(value);
            await fetch(`${apiBase}/shorts/${videoId}/comments`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ content: gifUrl ? value.replace(gifUrl, '').trim() : value, media_url: gifUrl, type: gifUrl ? 'gif' : 'text' }) });
            input.value = '';
            openShortComments(videoId);
        };
    }

    window.openVideoUploadModal = () => document.getElementById('short-upload-modal')?.classList.remove('hidden');
    window.cleanupShortsPlayback = () => { activeMedia = null; };

    document.addEventListener('DOMContentLoaded', () => {
        window.addEventListener('aero:view-change', (event) => { if (event.detail.view === 'shorts') loadShorts(); });
        document.addEventListener('click', (event) => {
            if (event.target.closest('#shorts-empty-upload')) window.openVideoUploadModal();
        });
        document.getElementById('shorts-stage')?.addEventListener('wheel', (event) => { if (Math.abs(event.deltaY) > 20) { event.preventDefault(); changeVideo(event.deltaY > 0 ? 1 : -1); } }, { passive: false });
        document.addEventListener('keydown', (event) => { if (document.getElementById('view-shorts')?.classList.contains('hidden')) return; if (event.key === 'ArrowDown') changeVideo(1); if (event.key === 'ArrowUp') changeVideo(-1); });
        document.querySelector('.comment-drawer-close')?.addEventListener('click', () => {
            const drawer = document.getElementById('shorts-comment-drawer');
            drawer?.classList.add('hidden');
            drawer?.closest('.shorts-container')?.classList.remove('comments-open');
        });
        document.getElementById('close-short-comments')?.addEventListener('click', () => {
            const drawer = document.getElementById('short-comments-drawer');
            drawer?.classList.add('hidden');
            drawer?.closest('.shorts-container')?.classList.remove('comments-open');
        });
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
