(() => {
    const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000/api' : `${window.location.origin}/api`;
    const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    const gifUrlPattern = /https?:\/\/[^\s<>"']+(?:\.gif(?:\?[^\s<>"']*)?|(?:media|i)\.giphy\.com|tenor\.com[^\s<>"']*)/i;
    const extractGifUrl = (content) => String(content || '').match(gifUrlPattern)?.[0] || '';
    const parseGifContent = (content, mediaUrl = '', type = '') => {
        const url = mediaUrl || extractGifUrl(content);
        return url ? { url, text: String(content || '').replace(url, '').replace('[GIF]', '').trim() } : { url: '', text: String(content || '') };
    };
    window.parseGifContent = parseGifContent;

    function getChatContactList() {
        return document.getElementById('chat-contacts-list') || document.getElementById('chat-contact-list');
    }

    function createChatContactButton(contact) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chat-contact';
        button.dataset.userId = String(contact.id);
        const avatarText = String(contact.username || contact.name || 'U').charAt(0).toUpperCase();
        button.innerHTML = `
            <span class="chat-contact-avatar">${contact.avatar_url ? `<img src="${contact.avatar_url.startsWith('http') ? contact.avatar_url : `${window.location.origin}${contact.avatar_url}`}" alt="" loading="lazy">` : avatarText}</span>
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
        const chatHeader = document.getElementById('chat-active-header');
        if (chatHeader) chatHeader.textContent = `@${contact.username || contact.name || 'User'}`;
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
        box.innerHTML = (messages || []).map((message) => {
            const gif = parseGifContent(message.content, message.media_url, message.type);
            return `<div class="chat-message ${message.sender_id === currentUser.id ? 'mine' : ''}"><div class="chat-bubble-content">${gif.url ? `<img src="${escapeText(gif.url)}" class="chat-gif-media" alt="GIF" loading="lazy">` : ''}${gif.text ? escapeText(gif.text) : ''}</div></div>`;
        }).join('');
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
