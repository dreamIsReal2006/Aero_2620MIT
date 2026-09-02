const API_BASE =
    window.location.protocol === 'file:'
        ? 'http://127.0.0.1:5000/api'
        : `${window.location.origin}/api`;

const API_ORIGIN = API_BASE.replace(/\/api$/, '');

let currentProfile = null;
let currentUser = null;
let isOwnProfile = false;


/* =========================
   Authentication
========================= */

function getToken() {
    return localStorage.getItem('aero_token');
}

function getStoredUser() {
    try {
        return JSON.parse(
            localStorage.getItem('aero_user') || '{}'
        );
    } catch {
        return {};
    }
}


/* =========================
   API
========================= */

async function apiRequest(url, options = {}) {

    const token = getToken();

    const headers = {
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers['Content-Type']
    ) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            `Request failed (${response.status})`
        );
    }

    return data;
}


/* =========================
   URL handling
========================= */

function resolveMediaUrl(url) {

    if (!url) {
        return '';
    }

    const value = String(url).trim();

    if (!value) {
        return '';
    }

    if (
        /^(https?:\/\/|blob:|data:)/i.test(value)
    ) {
        return value;
    }

    if (value.startsWith('/')) {
        return `${API_ORIGIN}${value}`;
    }

    return `${API_ORIGIN}/${value}`;
}


/* =========================
   DOM helpers
========================= */

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {

    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


/* =========================
   Profile lookup
========================= */

function getProfileIdentifier() {

    const params = new URLSearchParams(
        window.location.search
    );

    const userId = params.get('id');
    const username = params.get('username');

    return {
        userId,
        username
    };
}


async function loadOwnProfile() {

    return apiRequest(
        `${API_BASE}/users/me/profile`
    );
}


async function loadProfileById(userId) {

    return apiRequest(
        `${API_BASE}/users/${encodeURIComponent(userId)}/profile`
    );
}


async function searchUser(username) {

    const data = await apiRequest(
        `${API_BASE}/search?q=${encodeURIComponent(username)}`
    );

    const results =
        Array.isArray(data)
            ? data
            : (
                data.results ||
                data.users ||
                data.items ||
                []
            );

    const exactMatch = results.find(user =>
        String(user.username || '').toLowerCase() ===
        String(username).toLowerCase()
    );

    return exactMatch || results[0] || null;
}


async function loadProfile() {

    const identifier = getProfileIdentifier();

    currentUser = getStoredUser();

    try {

        let data;

        /*
         * No profile identifier means
         * current user's profile.
         */

        if (!identifier.userId &&
            !identifier.username) {

            data = await loadOwnProfile();

            isOwnProfile = true;

        } else if (identifier.userId) {

            data = await loadProfileById(
                identifier.userId
            );

            isOwnProfile =
                currentUser.id &&
                String(currentUser.id) ===
                String(identifier.userId);

        } else {

            const user = await searchUser(
                identifier.username
            );

            if (!user || !user.id) {
                throw new Error(
                    'User not found.'
                );
            }

            data = await loadProfileById(
                user.id
            );

            isOwnProfile =
                currentUser.id &&
                String(currentUser.id) ===
                String(user.id);
        }

        currentProfile = data;

        renderProfile(data);

    } catch (error) {

        console.error(
            'Aero profile error:',
            error
        );

        showError(
            error.message ||
            'Unable to load profile.'
        );
    }
}


/* =========================
   Render profile
========================= */

function renderProfile(data) {

    const user =
        data.user || data.profile || data;

    currentProfile = {
        ...data,
        user
    };

    const username =
        user.username || 'User';

    const email =
        user.email || '';

    const bio =
        user.bio || '';

    const avatarUrl =
        user.avatar_url || '';

    $('profile-username').textContent =
        username;

    $('profile-email').textContent =
        isOwnProfile
            ? email
            : '';

    $('profile-bio').textContent =
        bio;

    document.title =
        `${username} - Aero`;

    renderAvatar(
        username,
        avatarUrl
    );

    renderStats(data);

    renderActions();

    renderPosts(
        data.posts || []
    );

    $('profile-loading').style.display =
        'none';

    $('profile-content').style.display =
        'block';
}


/* =========================
   Avatar
========================= */

function renderAvatar(
    username,
    avatarUrl
) {

    const container =
        $('profile-avatar');

    container.innerHTML = '';

    const safeName =
        String(username || 'User');

    if (!avatarUrl) {

        container.textContent =
            safeName.charAt(0).toUpperCase();

        return;
    }

    const image =
        document.createElement('img');

    image.src =
        resolveMediaUrl(avatarUrl);

    image.alt =
        `${safeName}'s avatar`;

    image.loading =
        'lazy';

    image.onerror = () => {

        container.innerHTML = '';

        container.textContent =
            safeName.charAt(0).toUpperCase();
    };

    container.appendChild(image);
}


/* =========================
   Stats
========================= */

function renderStats(data) {

    const posts =
        Array.isArray(data.posts)
            ? data.posts
            : [];

    $('profile-post-count').textContent =
        posts.length;

    $('profile-followers').textContent =
        data.followers_count ?? 0;

    $('profile-following').textContent =
        data.following_count ?? 0;
}


/* =========================
   Buttons
========================= */

function renderActions() {

    const followButton =
        $('profile-follow-btn');

    const editButton =
        $('profile-edit-btn');

    if (isOwnProfile) {

        followButton.style.display =
            'none';

        editButton.style.display =
            'inline-block';

        return;
    }

    editButton.style.display =
        'none';

    followButton.style.display =
        'inline-block';

    const user =
        currentProfile.user || {};

    const following =
        Boolean(
            currentProfile.is_following ||
            user.is_following
        );

    updateFollowButton(
        following
    );
}


function updateFollowButton(
    following
) {

    const button =
        $('profile-follow-btn');

    button.textContent =
        following
            ? 'Following'
            : 'Follow';

    button.classList.toggle(
        'following',
        following
    );
}


/* =========================
   Follow / unfollow
========================= */

async function toggleFollow() {

    if (!currentProfile ||
        !currentProfile.user ||
        !currentProfile.user.id) {

        return;
    }

    const button =
        $('profile-follow-btn');

    const userId =
        currentProfile.user.id;

    button.disabled =
        true;

    try {

        const data = await apiRequest(
            `${API_BASE}/social/follow/${userId}`,
            {
                method: 'POST'
            }
        );

        updateFollowButton(
            Boolean(data.is_following)
        );

        if (
            data.followers_count !==
            undefined
        ) {
            $('profile-followers').textContent =
                data.followers_count;
        }

        currentProfile.is_following =
            Boolean(data.is_following);

    } catch (error) {

        console.error(
            'Aero follow error:',
            error
        );

        alert(
            error.message ||
            'Unable to update follow.'
        );

    } finally {

        button.disabled =
            false;
    }
}


/* =========================
   Posts / Flips
========================= */

function renderPosts(posts) {

    const container =
        $('profile-posts');

    const title =
        $('profile-posts-title');

    container.innerHTML = '';

    if (!posts.length) {

        title.style.display =
            'block';

        container.innerHTML = `
            <div class="profile-empty">
                No posts yet.
            </div>
        `;

        return;
    }

    title.style.display =
        'block';

    posts.forEach(post => {

        container.appendChild(
            createPostElement(post)
        );
    });
}


function createPostElement(post) {

    const article =
        document.createElement('article');

    article.className =
        'profile-post';

    const content =
        post.content || '';

    if (content) {

        const text =
            document.createElement('p');

        text.className =
            'profile-post-content';

        text.textContent =
            content;

        article.appendChild(text);
    }

    renderPostMedia(
        article,
        post
    );

    const date =
        document.createElement('div');

    date.className =
        'profile-post-date';

    date.textContent =
        formatDate(
            post.created_at
        );

    article.appendChild(date);

    return article;
}


function renderPostMedia(
    article,
    post
) {

    if (
        !Array.isArray(post.images) ||
        post.images.length === 0
    ) {
        return;
    }

    const mediaContainer =
        document.createElement('div');

    mediaContainer.className =
        'profile-post-media';

    post.images.forEach(
        mediaUrl => {

            const url =
                resolveMediaUrl(mediaUrl);

            if (!url) {
                return;
            }

            const isVideo =
                /\.(mp4|webm|mov|m4v)(?:$|\?)/i
                    .test(url);

            const element =
                document.createElement(
                    isVideo
                        ? 'video'
                        : 'img'
                );

            element.src =
                url;

            if (isVideo) {

                element.controls =
                    true;

                element.preload =
                    'metadata';

                element.playsInline =
                    true;

            } else {

                element.alt =
                    'Post media';

                element.loading =
                    'lazy';
            }

            element.addEventListener(
                'error',
                () => {

                    console.error(
                        'Aero media failed:',
                        url
                    );
                }
            );

            mediaContainer.appendChild(
                element
            );
        }
    );

    if (mediaContainer.children.length) {

        article.appendChild(
            mediaContainer
        );
    }
}


/* =========================
   Date formatting
========================= */

function formatDate(timestamp) {

    if (!timestamp) {
        return '';
    }

    const date =
        new Date(timestamp);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return '';
    }

    return date.toLocaleString(
        undefined,
        {
            dateStyle: 'medium',
            timeStyle: 'short'
        }
    );
}


/* =========================
   Edit profile
========================= */

function openEditModal() {

    if (!currentProfile ||
        !currentProfile.user) {

        return;
    }

    const user =
        currentProfile.user;

    $('edit-username').value =
        user.username || '';

    $('edit-bio').value =
        user.bio || '';

    $('edit-avatar').value =
        user.avatar_url || '';

    $('profile-edit-modal')
        .classList.add('active');
}


function closeEditModal() {

    $('profile-edit-modal')
        .classList.remove('active');
}


async function saveProfile() {

    const username =
        $('edit-username').value.trim();

    const bio =
        $('edit-bio').value.trim();

    const avatarUrl =
        $('edit-avatar').value.trim();

    if (!username) {

        alert(
            'Username cannot be empty.'
        );

        return;
    }

    const saveButton =
        $('profile-save-btn');

    saveButton.disabled =
        true;

    try {

        const data =
            await apiRequest(
                `${API_BASE}/users/me/profile`,
                {
                    method: 'PUT',

                    body: JSON.stringify({
                        username,
                        bio,
                        avatar_url: avatarUrl
                    })
                }
            );

        if (data.user) {

            currentProfile.user =
                data.user;
        }

        /*
         * Keep the locally cached user
         * synchronized with the backend.
         */

        const storedUser =
            getStoredUser();

        const updatedUser = {
            ...storedUser,
            ...(data.user || {}),
            username,
            bio,
            avatar_url: avatarUrl
        };

        localStorage.setItem(
            'aero_user',
            JSON.stringify(updatedUser)
        );

        closeEditModal();

        renderProfile(
            currentProfile
        );

    } catch (error) {

        console.error(
            'Aero profile update error:',
            error
        );

        alert(
            error.message ||
            'Unable to update profile.'
        );

    } finally {

        saveButton.disabled =
            false;
    }
}


/* =========================
   Errors
========================= */

function showError(message) {

    $('profile-loading').innerHTML = `
        <div class="profile-error">
            ${escapeHtml(message)}
        </div>
    `;
}


/* =========================
   Navigation
========================= */

function goHome() {

    /*
     * Return to Aero's main feed.
     */

    window.location.href =
        'index.html';
}


/* =========================
   Event listeners
========================= */

function setupEvents() {

    $('profile-back-btn')
        .addEventListener(
            'click',
            goHome
        );

    $('profile-follow-btn')
        .addEventListener(
            'click',
            toggleFollow
        );

    $('profile-edit-btn')
        .addEventListener(
            'click',
            openEditModal
        );

    $('profile-cancel-btn')
        .addEventListener(
            'click',
            closeEditModal
        );

    $('profile-save-btn')
        .addEventListener(
            'click',
            saveProfile
        );

    $('profile-edit-modal')
        .addEventListener(
            'click',
            event => {

                if (
                    event.target.id ===
                    'profile-edit-modal'
                ) {
                    closeEditModal();
                }
            }
        );
}


/* =========================
   Start
========================= */

document.addEventListener(
    'DOMContentLoaded',
    () => {

        setupEvents();

        loadProfile();
    }
);