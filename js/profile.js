/* =========================================================
   AERO PROFILE PAGE
   ========================================================= */

const API_BASE =
    window.location.protocol === 'file:'
        ? 'http://127.0.0.1:5000/api'
        : `${window.location.origin}/api`;

const API_ORIGIN = API_BASE.replace(/\/api$/, '');


/* =========================================================
   HELPERS
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


function getCurrentUser() {
    try {
        return JSON.parse(
            localStorage.getItem('aero_user') || '{}'
        );
    } catch (error) {
        return {};
    }
}


function getToken() {
    return localStorage.getItem('aero_token');
}


function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


function resolveMediaUrl(url) {
    if (!url) {
        return '';
    }

    const value = String(url).trim();

    if (!value) {
        return '';
    }

    if (/^(https?:\/\/|blob:|data:)/i.test(value)) {
        return value;
    }

    if (value.startsWith('/')) {
        return `${API_ORIGIN}${value}`;
    }

    return `${API_ORIGIN}/${value}`;
}


/* =========================================================
   API
   ========================================================= */

async function apiRequest(endpoint, options = {}) {
    const token = getToken();

    const headers = {
        ...options.headers
    };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(
        `${API_BASE}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    let data = null;

    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (!response.ok) {
        const message =
            data?.message ||
            data?.error ||
            `Request failed (${response.status})`;

        throw new Error(message);
    }

    return data;
}


/* =========================================================
   PROFILE STATE
   ========================================================= */

let profileUser = null;
let isOwnProfile = false;


/* =========================================================
   GET PROFILE TARGET
   ========================================================= */

function getProfileTarget() {
    const params = new URLSearchParams(
        window.location.search
    );

    const id = params.get('id');
    const username = params.get('username');

    return {
        id,
        username
    };
}


/* =========================================================
   LOAD PROFILE
   ========================================================= */

async function loadProfile() {
    const token = getToken();

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const target = getProfileTarget();
        const currentUser = getCurrentUser();

        let profileData;

        /*
         * No ID or username means the current user's profile.
         */
        if (!target.id && !target.username) {
            profileData = await apiRequest(
                '/users/me/profile'
            );

            isOwnProfile = true;
        }

        /*
         * Profile by user ID.
         */
        else if (target.id) {
            profileData = await apiRequest(
                `/users/${encodeURIComponent(target.id)}/profile`
            );

            isOwnProfile =
                currentUser.id &&
                String(currentUser.id) === String(target.id);
        }

        /*
         * Profile by username.
         */
        else {
            const searchData = await apiRequest(
                `/search?q=${encodeURIComponent(target.username)}`
            );

            const results =
                searchData?.users ||
                searchData?.results ||
                [];

            const matchedUser = results.find(
                user =>
                    String(user.username || '').toLowerCase() ===
                    String(target.username).toLowerCase()
            );

            if (!matchedUser) {
                throw new Error('User not found.');
            }

            profileData = await apiRequest(
                `/users/${encodeURIComponent(matchedUser.id)}/profile`
            );

            isOwnProfile =
                currentUser.id &&
                String(currentUser.id) ===
                String(matchedUser.id);
        }

        profileUser = profileData?.user || null;

        if (!profileUser) {
            throw new Error('Profile data is unavailable.');
        }

        renderProfile(
            profileData,
            isOwnProfile
        );

    } catch (error) {
        console.error(
            'Unable to load profile:',
            error
        );

        showProfileError(
            error.message || 'Unable to load profile.'
        );
    }
}


/* =========================================================
   RENDER PROFILE
   ========================================================= */

function renderProfile(data, ownProfile) {
    const user = data.user || {};

    $('profile-username').textContent =
        user.username || 'User';

    /*
     * Email should only be displayed on
     * the current user's own profile.
     */
    if (ownProfile && user.email) {
        $('profile-email').textContent =
            user.email;
    } else {
        $('profile-email').textContent = '';
    }

    $('profile-bio').textContent =
        user.bio || '';

    $('profile-follower-count').textContent =
        Number(data.followers_count || 0);

    $('profile-following-count').textContent =
        Number(data.following_count || 0);

    const posts =
        Array.isArray(data.posts)
            ? data.posts
            : [];

    $('profile-post-count').textContent =
        posts.length;

    renderProfileAvatar(
        user.username,
        user.avatar_url
    );

    renderPosts(posts);

    setupProfileActions(
        user,
        ownProfile
    );
}


/* =========================================================
   PROFILE AVATAR
   ========================================================= */

function renderProfileAvatar(username, avatarUrl) {
    const avatar = $('profile-avatar');

    if (!avatar) {
        return;
    }

    const name =
        String(username || 'User');

    avatar.innerHTML = '';

    if (!avatarUrl) {
        avatar.textContent =
            name.charAt(0).toUpperCase();

        return;
    }

    const image =
        document.createElement('img');

    image.src =
        resolveMediaUrl(avatarUrl);

    image.alt =
        `${name}'s profile picture`;

    image.onerror = () => {
        image.remove();

        avatar.textContent =
            name.charAt(0).toUpperCase();
    };

    avatar.appendChild(image);
}


/* =========================================================
   PROFILE ACTIONS
   ========================================================= */

function setupProfileActions(user, ownProfile) {
    const followButton =
        $('profile-follow-btn');

    const editButton =
        $('profile-edit-btn');

    /*
     * Own profile:
     * show Edit Profile.
     *
     * Editing itself is handled by
     * Settings > Account.
     */
    if (ownProfile) {
        followButton.hidden = true;
        editButton.hidden = false;

        editButton.onclick = () => {
            window.location.href =
                'settings.html?section=account';
        };

        return;
    }

    /*
     * Other user's profile:
     * show Follow button.
     */
    editButton.hidden = true;
    followButton.hidden = false;

    setupFollowButton(
        user
    );
}


/* =========================================================
   FOLLOW
   ========================================================= */

function setupFollowButton(user) {
    const button =
        $('profile-follow-btn');

    if (!button || !user?.id) {
        return;
    }

    /*
     * The backend profile endpoint may provide
     * is_following in future versions.
     */
    let isFollowing =
        Boolean(user.is_following);

    updateFollowButton(
        button,
        isFollowing
    );

    button.onclick = async () => {
        button.disabled = true;

        try {
            const data = await apiRequest(
                `/social/follow/${encodeURIComponent(user.id)}`,
                {
                    method: 'POST'
                }
            );

            isFollowing =
                Boolean(data.is_following);

            updateFollowButton(
                button,
                isFollowing
            );

            if (
                typeof data.followers_count ===
                'number'
            ) {
                $('profile-follower-count')
                    .textContent =
                    data.followers_count;
            }

        } catch (error) {
            console.error(
                'Unable to update follow:',
                error
            );

            alert(
                error.message ||
                'Unable to update follow.'
            );
        } finally {
            button.disabled = false;
        }
    };
}


function updateFollowButton(button, isFollowing) {
    button.textContent =
        isFollowing
            ? 'Following'
            : 'Follow';
}


/* =========================================================
   POSTS
   ========================================================= */

function renderPosts(posts) {
    const container =
        $('profile-posts');

    container.innerHTML = '';

    if (!posts.length) {
        container.innerHTML = `
            <div class="profile-empty">
                No posts yet.
            </div>
        `;

        return;
    }

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
        document.createElement('p');

    content.className =
        'profile-post-content';

    content.textContent =
        post.content || '';

    article.appendChild(content);

    /*
     * Images
     */
    const images =
        Array.isArray(post.images)
            ? post.images
            : [];

    if (images.length) {
        const imageContainer =
            document.createElement('div');

        imageContainer.className =
            'profile-post-images';

        images.forEach(imageUrl => {
            const image =
                document.createElement('img');

            image.src =
                resolveMediaUrl(imageUrl);

            image.alt =
                'Post image';

            image.loading =
                'lazy';

            image.onerror = () => {
                image.remove();
            };

            imageContainer.appendChild(
                image
            );
        });

        article.appendChild(
            imageContainer
        );
    }

    /*
     * Date
     */
    if (post.created_at) {
        const date =
            document.createElement('div');

        date.className =
            'profile-post-date';

        date.textContent =
            formatDate(post.created_at);

        article.appendChild(date);
    }

    return article;
}


/* =========================================================
   DATE
   ========================================================= */

function formatDate(dateValue) {
    const date =
        new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
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


/* =========================================================
   ERROR
   ========================================================= */

function showProfileError(message) {
    $('profile-username').textContent =
        'Unable to load profile';

    $('profile-email').textContent =
        '';

    $('profile-bio').textContent =
        '';

    $('profile-follow-btn').hidden =
        true;

    $('profile-edit-btn').hidden =
        true;

    $('profile-posts').innerHTML = `
        <div class="profile-error">
            ${escapeHtml(message)}
        </div>
    `;
}


/* =========================================================
   BACK BUTTON
   ========================================================= */

function setupBackButton() {
    const button =
        $('profile-back-btn');

    if (!button) {
        return;
    }

    button.addEventListener(
        'click',
        () => {
            window.location.href =
                'index.html';
        }
    );
}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
    'DOMContentLoaded',
    () => {
        setupBackButton();
        loadProfile();
    }
);