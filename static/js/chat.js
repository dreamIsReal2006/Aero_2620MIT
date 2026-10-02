// Chat UI, presence polling, and message delivery controller
// From: index.html chat controls -> To: /api/chat and messages tables
(() => {
    const supabaseConfig = window.AeroConfig || {};
    const supabaseFactory = window.supabase?.createClient;
    window.supabaseClient = supabaseFactory && supabaseConfig.SUPABASE_ANON_KEY && !supabaseConfig.SUPABASE_ANON_KEY.startsWith('YOUR_')
        ? supabaseFactory(supabaseConfig.SUPABASE_URL, supabaseConfig.SUPABASE_ANON_KEY)
        : null;

    const apiBase = window.AeroConfig.API_BASE_URL;
    const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const renderMessageText = (value) => escapeText(value).replace(
        /(https?:\/\/[^\s<]+|\/#post-\d+)/g,
        '<a class="chat-message-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    const gifUrlPattern = /https?:\/\/[^\s<>"']+(?:\.gif(?:\?[^\s<>"']*)?|(?:media|i)\.giphy\.com|tenor\.com[^\s<>"']*)/i;
    const extractGifUrl = (content) => String(content || '').match(gifUrlPattern)?.[0] || '';
    const parseGifContent = (content, mediaUrl = '', type = '') => {
        const url = mediaUrl || extractGifUrl(content);
        return url ? { url, text: String(content || '').replace(url, '').replace('[GIF]', '').trim() } : { url: '', text: String(content || '') };
    };
    window.parseGifContent = parseGifContent;
    const renderDeliveryStatus = (message) => {
        if (!message?.is_mine && !message?.sender_id) return '';
        const status = message.status === 'sending' ? 'sent' : (message.is_read ? 'read' : 'delivered');
        const secondTick = status === 'sent' ? '' : '<path d="M14.5001 0.999939L8.00006 7.49994"/>';
        return `<span class="message-status ${status}" aria-label="${status}"><svg width="16" height="11" viewBox="0 0 16 11" fill="none" class="status-ticks" aria-hidden="true"><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11.0001 0.999939L4.50006 7.49994L1.50006 4.49994"/>${secondTick}</g></svg></span>`;
    };

    const setMuteButtonState = (button, muted) => {
        if (!button) return;
        button.classList.toggle('is-muted', muted);
        button.setAttribute('aria-label', muted ? 'Unmute user' : 'Mute user');
        button.title = muted ? 'Unmute user' : 'Mute user';
        button.innerHTML = muted
            ? '<svg class="chat-header-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path><path d="m4 4 16 16"></path></svg>'
            : '<svg class="chat-header-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path></svg>';
    };

    function getChatContactList() {
        return document.getElementById('chat-contacts-list') || document.getElementById('chat-contact-list');
    }

    function renderChatHeader(contact) {
        const name = contact?.username || contact?.name || 'User';
        const nameElement = document.getElementById('chat-active-name');
        const header = document.getElementById('chat-active-header');
        const avatarElement = document.getElementById('chat-active-avatar');
        if (!header || !avatarElement) return;
        if (nameElement) {
            nameElement.textContent = `@${name}`;
            nameElement.setAttribute('data-i18n-aria-label', 'chat.info.open');
            nameElement.setAttribute('aria-label', window.AeroI18n?.t?.('chat.info.open') || 'Open conversation info');
        }
        const avatarLink = document.getElementById('chat-active-avatar-link');
        avatarLink?.setAttribute('data-i18n-aria-label', 'chat.info.open');
        avatarLink?.setAttribute('aria-label', window.AeroI18n?.t?.('chat.info.open') || 'Open conversation info');
        const muteButton = document.getElementById('chat-mute-btn');
        muteButton?.classList.toggle('hidden', !contact?.id);
        if (muteButton) {
            setMuteButtonState(muteButton, Boolean(contact?.is_muted));
        }
        window.AeroChatAvatar?.set(avatarElement, contact, name, contact?.is_online);
    }

    function createChatContactButton(contact) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-contact';
        button.dataset.userId = String(contact.id);
        const avatarMarkup = window.AeroChatAvatar?.markup(contact, `chat-contact-avatar${contact.is_online ? ' is-online' : ''}`)
            || `<span class="chat-contact-avatar">${escapeText((contact.username || contact.name || 'U').charAt(0).toUpperCase())}</span>`;
        button.innerHTML = `
            ${avatarMarkup}
            <span><strong>@${escapeText(contact.username || contact.name || 'User')}</strong><small>${escapeText(contact.latest_message || 'Start a conversation')}</small></span>
        `;
        button.addEventListener('click', () => {
            if (typeof window.selectChatContact === 'function') {
                window.selectChatContact(contact);
            } else if (typeof selectChatContact === 'function') {
                selectChatContact(contact);
            }
        });
        return button;
    }

    window.addContactToChatList = function addContactToChatList(user) {
        const contact = {
            id: user?.id ?? user?.user_id,
            username: user?.name || user?.username || user?.userName || 'User',
            name: user?.name || user?.username || user?.userName || 'User',
            avatar_url: user?.avatar || user?.avatar_url || '',
            latest_message: 'Start a conversation'
        };

        if (!contact.id && contact.id !== 0) return;
        const list = getChatContactList();
        if (!list) return;

        const existing = list.querySelector(`[data-user-id="${CSS.escape(String(contact.id))}"]`);
        if (existing) return;

        const button = createChatContactButton(contact);
        list.prepend(button);
    };

    window.legacySelectChatContact = async function legacySelectChatContact(contact) {
        if (!contact) return;
        window.activeChatUser = contact;
        document.getElementById('view-chat')?.classList.add('chat-contact-open');
        renderChatHeader(contact);
        const list = getChatContactList();
        if (list) {
            list.querySelectorAll('.chat-contact').forEach((item) => {
                item.classList.toggle('active', String(item.dataset.userId) === String(contact.id));
            });
        }
        const currentUser = JSON.parse(localStorage.getItem('aero_user') || '{}');
        const response = await fetch(`${apiBase}/chat/messages?contact_id=${contact.id}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
        const messages = await response.json().catch(() => []);
        const box = document.getElementById('chat-messages-list') || document.getElementById('chat-messages');
        if (!box) return;
        const attachmentMarkup = (message) => {
            const url = message.media_url ? (String(message.media_url).startsWith('http') ? message.media_url : `${window.AeroConfig.API_ORIGIN}${message.media_url}`) : '';
            if (!url) return '';
            const videoType = /\.mov(?:$|\?)/i.test(url) ? 'video/quicktime' : /\.webm(?:$|\?)/i.test(url) ? 'video/webm' : /\.m4v(?:$|\?)/i.test(url) ? 'video/x-m4v' : 'video/mp4';
            if (message.type === 'image' || message.type === 'gif') return `<button type="button" class="chat-media-preview" data-lightbox-src="${escapeText(url)}"><img src="${escapeText(url)}" alt="Attached image" loading="lazy"></button>`;
            if (message.type === 'video') return `<video class="chat-inline-video" controls preload="metadata" playsinline crossorigin="anonymous"><source src="${escapeText(url)}" type="${videoType}"></video>`;
            if (message.type === 'audio') return `<audio class="chat-inline-audio" src="${escapeText(url)}" controls></audio>`;
            return `<a class="chat-document-card" href="${escapeText(url)}" download><span class="chat-document-ext">${escapeText((message.file_name || 'FILE').split('.').pop().toUpperCase())}</span><span><strong>${escapeText(message.file_name || 'Attached document')}</strong><small>${escapeText(String(message.file_size || 0))} bytes</small></span><span class="chat-document-download">↓</span></a>`;
        };
        const sharedPostMarkup = (post) => post ? `<a class="chat-shared-post" href="/#post-${post.id}"><span class="chat-shared-post-author"><span class="chat-shared-post-avatar">${post.avatar_url ? `<img src="${escapeText(post.avatar_url)}" alt="">` : escapeText((post.username || 'U').charAt(0).toUpperCase())}</span><strong>@${escapeText(post.username || 'User')}</strong></span><span class="chat-shared-post-text">${escapeText(window.AeroI18n?.t('shared_post_from', { user: `@${post.username || 'User'}` }) || `Shared a post from @${post.username || 'User'}`)}: ${escapeText(post.content || '')}</span></a>` : '';
        box.innerHTML = (messages || []).map((message) => {
            const gif = parseGifContent(message.content, message.media_url, message.type);
            const timestamp = window.AeroI18n?.formatChatTimestamp?.(message.created_at) || '';
            const deleteButton = message.can_delete ? `<span class="chat-message-tools"><button type="button" data-delete-message="${message.id}" aria-label="Delete message">Delete</button></span>` : '';
            return `<div class="chat-message ${message.sender_id === currentUser.id ? 'mine' : ''}" data-message-id="${message.id}"><div class="chat-bubble-content">${message.shared_post ? sharedPostMarkup(message.shared_post) : (message.type === 'text' || message.type === 'shared_post' || message.type === 'post_share' ? '' : attachmentMarkup(message))}${message.type === 'post_share' ? '' : (gif.text ? renderMessageText(gif.text) : '')}</div><div class="chat-message-meta"><time>${escapeText(timestamp)}</time>${message.sender_id === currentUser.id ? renderDeliveryStatus({ ...message, is_mine: true }) : ''}${deleteButton}</div></div>`;
        }).join('');
        box.querySelectorAll('[data-lightbox-src]').forEach((item) => item.addEventListener('click', () => { const lightbox = document.getElementById('chat-lightbox'); const image = document.getElementById('chat-lightbox-image'); if (lightbox && image) { image.src = item.dataset.lightboxSrc; lightbox.classList.remove('hidden'); } }));
        box.querySelectorAll('[data-delete-message]').forEach((button) => button.addEventListener('click', async () => {
            const response = await fetch(`${apiBase}/chat/messages/${button.dataset.deleteMessage}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
            if (response.ok) button.closest('.chat-message')?.remove();
            else window.showNotice?.('Unable to delete message.', 'error');
        }));
        box.scrollTop = box.scrollHeight;
        document.getElementById('view-chat')?.classList.remove('hidden');
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('chat-current-username').textContent = JSON.parse(localStorage.getItem('aero_user') || '{}').username || 'Messages';
        fetch(`${apiBase}/notes`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } }).then((response) => response.ok ? response.json() : []).then((notes) => {
            const notesArea = document.querySelector('.chat-notes');
            if (notesArea) notesArea.innerHTML = notes.length ? notes.map((note) => `<span class="chat-note">${escapeText(note.content)}</span>`).join('') : '';
        }).catch(() => {});
    });
})();
