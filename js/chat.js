(() => {
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

    function contactAvatarUrl(contact) {
        const value = contact?.avatar_url || contact?.avatarUrl || contact?.avatar || '';
        return value && !String(value).startsWith('letter:')
            ? (String(value).startsWith('http') ? String(value) : `${window.AeroConfig.API_ORIGIN}${value}`)
            : '';
    }

    function renderChatHeader(contact) {
        const name = contact?.username || contact?.name || 'User';
        const nameElement = document.getElementById('chat-active-name');
        const header = document.getElementById('chat-active-header');
        const avatarElement = document.getElementById('chat-active-avatar');
        if (!header || !avatarElement) return;
        if (nameElement) nameElement.textContent = `@${name}`;
        const blockButton = document.getElementById('chat-block-btn');
        blockButton?.classList.toggle('hidden', !contact?.id);
        if (blockButton) blockButton.textContent = 'Block';
        const muteButton = document.getElementById('chat-mute-btn');
        muteButton?.classList.toggle('hidden', !contact?.id);
        if (muteButton) {
            setMuteButtonState(muteButton, Boolean(contact?.is_muted));
        }
        avatarElement.replaceChildren();
        avatarElement.classList.toggle('is-online', Boolean(contact?.is_online));
        const avatarUrl = contactAvatarUrl(contact);
        const letterAvatar = String(contact?.avatar_url || contact?.avatarUrl || contact?.avatar || '').startsWith('letter:')
            ? String(contact.avatar_url || contact.avatarUrl || contact.avatar).slice(7, 8).toUpperCase()
            : String(name).charAt(0).toUpperCase();
        if (avatarUrl) {
            const image = document.createElement('img');
            image.src = avatarUrl;
            image.alt = `@${name}`;
            image.loading = 'lazy';
            image.onerror = () => { avatarElement.replaceChildren(); avatarElement.textContent = letterAvatar || 'U'; };
            avatarElement.appendChild(image);
        } else {
            avatarElement.textContent = letterAvatar || 'U';
        }
    }

    function createChatContactButton(contact) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-contact';
        button.dataset.userId = String(contact.id);
        const avatarUrl = contactAvatarUrl(contact);
        const avatarValue = String(contact.avatar_url || contact.avatarUrl || contact.avatar || '');
        const avatarText = avatarValue.startsWith('letter:') ? avatarValue.slice(7, 8).toUpperCase() : String(contact.username || contact.name || 'U').charAt(0).toUpperCase();
        button.innerHTML = `
            <span class="chat-contact-avatar ${contact.is_online ? 'is-online' : ''}">${avatarUrl ? `<img src="${avatarUrl}" alt="" loading="lazy">` : avatarText}</span>
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

    window.selectChatContact = async function selectChatContact(contact) {
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
            if (message.type === 'image' || message.type === 'gif') return `<button type="button" class="chat-media-preview" data-lightbox-src="${escapeText(url)}"><img src="${escapeText(url)}" alt="Attached image" loading="lazy"></button>`;
            if (message.type === 'video') return `<video class="chat-inline-video" src="${escapeText(url)}" controls preload="metadata"></video>`;
            if (message.type === 'audio') return `<audio class="chat-inline-audio" src="${escapeText(url)}" controls></audio>`;
            return `<a class="chat-document-card" href="${escapeText(url)}" download><span class="chat-document-ext">${escapeText((message.file_name || 'FILE').split('.').pop().toUpperCase())}</span><span><strong>${escapeText(message.file_name || 'Attached document')}</strong><small>${escapeText(String(message.file_size || 0))} bytes</small></span><span class="chat-document-download">↓</span></a>`;
        };
        const sharedPostMarkup = (post) => post ? `<a class="chat-shared-post" href="/#post-${post.id}"><span class="chat-shared-post-author"><span class="chat-shared-post-avatar">${post.avatar_url ? `<img src="${escapeText(post.avatar_url)}" alt="">` : escapeText((post.username || 'U').charAt(0).toUpperCase())}</span><strong>@${escapeText(post.username || 'User')}</strong></span><span class="chat-shared-post-text">${escapeText(post.content || 'Shared post')}</span></a>` : '';
        box.innerHTML = (messages || []).map((message) => {
            const gif = parseGifContent(message.content, message.media_url, message.type);
            const timestamp = window.AeroI18n?.formatChatTimestamp?.(message.created_at) || '';
            const deleteButton = message.can_delete ? `<span class="chat-message-tools"><button type="button" data-delete-message="${message.id}" aria-label="Delete message">Delete</button></span>` : '';
            return `<div class="chat-message ${message.sender_id === currentUser.id ? 'mine' : ''}" data-message-id="${message.id}"><div class="chat-bubble-content">${message.shared_post ? sharedPostMarkup(message.shared_post) : (message.type === 'text' || message.type === 'shared_post' || message.type === 'post_share' ? '' : attachmentMarkup(message))}${message.type === 'post_share' ? '' : (gif.text ? renderMessageText(gif.text) : '')}</div><div class="chat-message-meta"><time>${escapeText(timestamp)}</time>${deleteButton}</div></div>`;
        }).join('');
        box.querySelectorAll('[data-lightbox-src]').forEach((item) => item.addEventListener('click', () => { const lightbox = document.getElementById('chat-lightbox'); const image = document.getElementById('chat-lightbox-image'); if (lightbox && image) { image.src = item.dataset.lightboxSrc; lightbox.classList.remove('hidden'); } }));
        box.querySelectorAll('[data-delete-message]').forEach((button) => button.addEventListener('click', async () => {
            const response = await fetch(`${apiBase}/chat/messages/${button.dataset.deleteMessage}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
            if (response.ok) button.closest('.chat-message')?.remove();
            else window.showNotice?.('Unable to delete message.', 'error');
        }));
        const blockButton = document.getElementById('chat-block-btn');
        if (blockButton) blockButton.onclick = async () => {
            if (!window.activeChatUser?.id) return;
            const contact = window.activeChatUser;
            const blocked = blockButton.classList.contains('is-blocked');
            const toggle = async () => {
                const response = await fetch(`${apiBase}/chat/contacts/${contact.id}/block`, { method: blocked ? 'DELETE' : 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('aero_token')}` } });
                if (response.ok) { blockButton.classList.toggle('is-blocked', !blocked); blockButton.textContent = blocked ? 'Block' : 'Unblock'; box.replaceChildren(); window.showNotice?.(blocked ? 'User unblocked.' : 'You have blocked this user.', 'success'); }
            };
            if (blocked) await toggle(); else window.openChatBlockConfirmation?.(contact, toggle);
        };
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
