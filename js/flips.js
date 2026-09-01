const FlipsPage = {
    observer: null,
    loaded: false,

    getHeaders() {
        const token =
            localStorage.getItem("aero_token") ||
            localStorage.getItem("token");

        return token
            ? {
                Authorization: `Bearer ${token}`
            }
            : {};
    },

    getApiBase() {
        if (typeof API_BASE !== "undefined") {
            return API_BASE;
        }

        return "/api";
    },

    escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value || "";
        return div.innerHTML;
    },

    getMediaUrl(url) {
        if (!url) return "";

        return String(url);
    },

    isVideo(url) {
        if (!url) return false;

        return /\.(mp4|webm|mov)(\?.*)?$/i.test(String(url));
    },

    async apiRequest(url, options = {}) {
        const headers = {
            Accept: "application/json",
            ...this.getHeaders(),
            ...(options.headers || {})
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        let data = null;

        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok) {
            throw new Error(
                data?.error ||
                data?.message ||
                `Request failed (${response.status})`
            );
        }

        return data;
    },

    async show() {
        const feed = document.getElementById("feed-container");
        const search = document.getElementById("search-results-page");
        const flips = document.getElementById("flips-page");

        if (!flips) return;

        feed?.classList.add("hidden");
        search?.classList.add("hidden");
        flips.classList.remove("hidden");

        document.body.classList.add("flips-open");

        document.querySelectorAll(".dock-btn").forEach(button => {
            button.classList.remove("active");
        });

        document
            .getElementById("flips-nav-btn")
            ?.classList.add("active");

        if (!this.loaded) {
            await this.load();
        } else {
            this.observeVideos();
        }
    },

    hide() {
        document
            .getElementById("flips-page")
            ?.classList.add("hidden");

        document.body.classList.remove("flips-open");

        this.pauseAllVideos();

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    },

    async load() {
        const flipsFeed =
            document.getElementById("flips-feed");

        if (!flipsFeed) return;

        flipsFeed.innerHTML = `
            <div class="flips-state">
                <div class="flips-loader"></div>
                <span>Loading Flips...</span>
            </div>
        `;

        try {
            const data = await this.apiRequest(
                `${this.getApiBase()}/posts`
            );

            const posts =
                Array.isArray(data)
                    ? data
                    : data.posts || [];

            const videoPosts = posts.filter(post => {
                const media = this.getPostMedia(post);

                return media.some(item =>
                    this.isVideo(item)
                );
            });

            this.render(videoPosts);
            this.loaded = true;

        } catch (error) {
            console.error("Unable to load Flips:", error);

            flipsFeed.innerHTML = `
                <div class="flips-state">
                    <strong>Unable to load Flips</strong>
                    <span>${this.escapeHtml(error.message)}</span>
                    <button type="button" id="retry-flips-btn">
                        Retry
                    </button>
                </div>
            `;

            document
                .getElementById("retry-flips-btn")
                ?.addEventListener("click", () => {
                    this.load();
                });
        }
    },

    getPostMedia(post) {
        if (Array.isArray(post.images)) {
            return post.images.filter(Boolean);
        }

        if (typeof post.images === "string") {
            try {
                const parsed = JSON.parse(post.images);

                if (Array.isArray(parsed)) {
                    return parsed.filter(Boolean);
                }
            } catch (error) {
                return [post.images];
            }

            return [post.images];
        }

        if (Array.isArray(post.media)) {
            return post.media.filter(Boolean);
        }

        if (post.video_url) {
            return [post.video_url];
        }

        return [];
    },

    render(posts) {
        const flipsFeed =
            document.getElementById("flips-feed");

        if (!flipsFeed) return;

        if (!posts.length) {
            flipsFeed.innerHTML = `
                <div class="flips-state">
                    <strong>No Flips yet</strong>
                    <span>
                        Upload a video post to see it here.
                    </span>
                </div>
            `;

            return;
        }

        flipsFeed.innerHTML = posts.map(post => {
            const media = this.getPostMedia(post);

            const videoUrl =
                media.find(item => this.isVideo(item));

            const username =
                post.username ||
                post.user?.username ||
                post.author?.username ||
                "User";

            const content =
                post.content ||
                post.caption ||
                "";

            const likes =
                Number(
                    post.likes_count ??
                    post.like_count ??
                    post.likes ??
                    0
                );

            const comments =
                Number(
                    post.comments_count ??
                    post.comment_count ??
                    0
                );

            const avatar =
                post.avatar_url ||
                post.user?.avatar_url ||
                post.profile_picture ||
                "";

            const isLiked =
                Boolean(
                    post.is_liked ??
                    post.liked ??
                    false
                );

            return `
                <article
                    class="flip-card"
                    data-post-id="${post.id}"
                >
                    <video
                        class="flip-video"
                        src="${this.escapeHtml(this.getMediaUrl(videoUrl))}"
                        loop
                        muted
                        playsinline
                        preload="metadata"
                    ></video>

                    <div class="flip-overlay"></div>

                    <button
                        class="flip-sound-button"
                        type="button"
                        aria-label="Toggle sound"
                    >
                        🔇
                    </button>

                    <div class="flip-bottom">
                        <div class="flip-user">

                            <div class="flip-avatar">
                                ${
                                    avatar
                                        ? `
                                            <img
                                                src="${this.escapeHtml(this.getMediaUrl(avatar))}"
                                                alt="${this.escapeHtml(username)}"
                                            >
                                        `
                                        : `
                                            <span>
                                                ${this.escapeHtml(
                                                    username.charAt(0).toUpperCase()
                                                )}
                                            </span>
                                        `
                                }
                            </div>

                            <strong>
                                @${this.escapeHtml(username)}
                            </strong>

                        </div>

                        ${
                            content
                                ? `
                                    <p class="flip-caption">
                                        ${this.escapeHtml(content)}
                                    </p>
                                `
                                : ""
                        }
                    </div>

                    <div class="flip-actions">

                        <button
                            class="flip-action flip-like ${
                                isLiked ? "liked" : ""
                            }"
                            type="button"
                            data-liked="${isLiked}"
                            aria-label="Like"
                        >
                            <span class="flip-icon">♥</span>
                            <small>${likes}</small>
                        </button>

                        <button
                            class="flip-action flip-comment"
                            type="button"
                            aria-label="Comments"
                        >
                            <span class="flip-icon">💬</span>
                            <small>${comments}</small>
                        </button>

                        <button
                            class="flip-action flip-share"
                            type="button"
                            aria-label="Share"
                        >
                            <span class="flip-icon">↗</span>
                            <small>Share</small>
                        </button>

                    </div>
                </article>
            `;
        }).join("");

        this.bindEvents();
        this.observeVideos();
    },

    bindEvents() {
        document.querySelectorAll(".flip-card").forEach(card => {
            const postId = card.dataset.postId;
            const video = card.querySelector(".flip-video");

            const soundButton =
                card.querySelector(".flip-sound-button");

            const likeButton =
                card.querySelector(".flip-like");

            const commentButton =
                card.querySelector(".flip-comment");

            const shareButton =
                card.querySelector(".flip-share");

            card.addEventListener("click", event => {
                if (event.target.closest("button")) {
                    return;
                }

                if (video.paused) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            });

            soundButton?.addEventListener("click", () => {
                video.muted = !video.muted;

                soundButton.textContent =
                    video.muted ? "🔇" : "🔊";
            });

            likeButton?.addEventListener("click", async () => {
                await this.toggleLike(postId, likeButton);
            });

            commentButton?.addEventListener("click", async () => {
                await this.openComments(postId, card);
            });

            shareButton?.addEventListener("click", async () => {
                await this.shareFlip(postId);
            });
        });
    },

    async toggleLike(postId, button) {
    const wasLiked =
        button.dataset.liked === "true";

    button.disabled = true;

    try {
        const data = await this.apiRequest(
            `/interact/posts/${postId}/like`,
            {
                method: wasLiked
                    ? "DELETE"
                    : "POST"
            }
        );

        const isLiked = !wasLiked;

        button.dataset.liked =
            isLiked ? "true" : "false";

        button.classList.toggle(
            "liked",
            isLiked
        );

        const countElement =
            button.querySelector("small");

        if (countElement) {
            countElement.textContent =
                data.like_count ?? 0;
        }

    } catch (error) {
        console.error(
            "Unable to update like:",
            error
        );

        alert(error.message);

    } finally {
        button.disabled = false;
    }
},

    async getComments(postId) {
        return await this.apiRequest(
            `/interact/posts/${postId}/comments`,
            {
                method: "GET"
            }
        );
    },

    async createComment(postId, content) {
        return await this.apiRequest(
            `/interact/posts/${postId}/comments`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    content: content
                })
            }
        );
    },

    async openComments(postId, card) {
        let panel =
            card.querySelector(".flip-comments-panel");

        if (panel) {
            panel.remove();
            return;
        }

        panel = document.createElement("div");

        panel.className = "flip-comments-panel";

        panel.innerHTML = `
            <div class="flip-comments-header">
                <strong>Comments</strong>

                <button
                    type="button"
                    class="close-comments"
                    aria-label="Close comments"
                >
                    ×
                </button>
            </div>

            <div class="flip-comments-list">
                <div class="comments-loading">
                    Loading comments...
                </div>
            </div>

            <form class="flip-comment-form">

                <input
                    type="text"
                    class="flip-comment-input"
                    placeholder="Add a comment..."
                    maxlength="1000"
                    autocomplete="off"
                    required
                >

                <button
                    type="submit"
                    class="send-comment-button"
                >
                    Send
                </button>

            </form>
        `;

        card.appendChild(panel);

        panel
            .querySelector(".close-comments")
            ?.addEventListener("click", () => {
                panel.remove();
            });

        const form =
            panel.querySelector(".flip-comment-form");

        form?.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const input =
                    panel.querySelector(".flip-comment-input");

                const sendButton =
                    panel.querySelector(".send-comment-button");

                const content =
                    input.value.trim();

                if (!content) return;

                try {
                    input.disabled = true;
                    sendButton.disabled = true;
                    sendButton.textContent = "Sending...";

                    await this.createComment(
                        postId,
                        content
                    );

                    input.value = "";

                    await this.loadComments(
                        postId,
                        panel
                    );

                    this.increaseCommentCount(card);

                } catch (error) {
                    console.error(
                        "Unable to add comment:",
                        error
                    );

                    alert(
                        error.message ||
                        "Unable to add comment"
                    );

                } finally {
                    input.disabled = false;
                    sendButton.disabled = false;
                    sendButton.textContent = "Send";
                }
            }
        );

        await this.loadComments(postId, panel);
    },

    async loadComments(postId, panel) {
        const list =
            panel.querySelector(".flip-comments-list");

        if (!list) return;

        list.innerHTML = `
            <div class="comments-loading">
                Loading comments...
            </div>
        `;

        try {
            const data =
                await this.getComments(postId);

            const comments =
                Array.isArray(data)
                    ? data
                    : Array.isArray(data.comments)
                        ? data.comments
                        : [];

            if (!comments.length) {
                list.innerHTML = `
                    <div class="no-comments">
                        <span class="material-symbols-rounded">
                            chat_bubble_outline
                        </span>

                        <p>No comments yet.</p>

                        <small>
                            Be the first to comment.
                        </small>
                    </div>
                `;

                return;
            }

            list.innerHTML =
                comments.map(comment => {
                    const username =
                        comment.username ||
                        comment.user?.username ||
                        "User";

                    const content =
                        comment.content ||
                        "";

                    const avatar =
                        comment.avatar_url ||
                        comment.user?.avatar_url ||
                        "";

                    const createdAt =
                        comment.created_at ||
                        "";

                    return `
                        <div class="flip-comment-item">

                            <div class="comment-avatar">
                                ${
                                    avatar
                                        ? `
                                            <img
                                                src="${this.escapeHtml(this.getMediaUrl(avatar))}"
                                                alt="${this.escapeHtml(username)}"
                                            >
                                        `
                                        : `
                                            <span>
                                                ${this.escapeHtml(
                                                    username.charAt(0).toUpperCase()
                                                )}
                                            </span>
                                        `
                                }
                            </div>

                            <div class="comment-content">

                                <strong>
                                    @${this.escapeHtml(username)}
                                </strong>

                                <p>
                                    ${this.escapeHtml(content)}
                                </p>

                                ${
                                    createdAt
                                        ? `
                                            <small>
                                                ${this.formatCommentDate(createdAt)}
                                            </small>
                                        `
                                        : ""
                                }

                            </div>

                        </div>
                    `;
                }).join("");

        } catch (error) {
            console.error(
                "Unable to load comments:",
                error
            );

            list.innerHTML = `
                <div class="no-comments">

                    <p>
                        Unable to load comments.
                    </p>

                    <button
                        type="button"
                        class="retry-comments"
                    >
                        Retry
                    </button>

                </div>
            `;

            list
                .querySelector(".retry-comments")
                ?.addEventListener("click", () => {
                    this.loadComments(postId, panel);
                });
        }
    },

    increaseCommentCount(card) {
        const button =
            card.querySelector(".flip-comment");

        const countElement =
            button?.querySelector("small");

        if (!countElement) return;

        const count =
            Number(countElement.textContent) || 0;

        countElement.textContent = count + 1;
    },

    formatCommentDate(dateValue) {
        try {
            const date = new Date(dateValue);

            if (Number.isNaN(date.getTime())) {
                return "";
            }

            const difference =
                Date.now() - date.getTime();

            const seconds =
                Math.floor(difference / 1000);

            const minutes =
                Math.floor(seconds / 60);

            const hours =
                Math.floor(minutes / 60);

            const days =
                Math.floor(hours / 24);

            if (seconds < 60) {
                return "Just now";
            }

            if (minutes < 60) {
                return `${minutes}m`;
            }

            if (hours < 24) {
                return `${hours}h`;
            }

            if (days < 7) {
                return `${days}d`;
            }

            return date.toLocaleDateString();

        } catch (error) {
            return "";
        }
    },

    async shareFlip(postId) {
        const shareUrl =
            `${window.location.origin}${window.location.pathname}#flip-${postId}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: "Aero Flip",
                    url: shareUrl
                });
            } else {
                await navigator.clipboard.writeText(
                    shareUrl
                );

                alert("Flip link copied!");
            }
        } catch (error) {
            console.log("Share cancelled");
        }
    },

    observeVideos() {
        if (this.observer) {
            this.observer.disconnect();
        }

        const feed =
            document.getElementById("flips-feed");

        if (!feed) return;

        this.observer =
            new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        const video =
                            entry.target.querySelector(
                                ".flip-video"
                            );

                        if (!video) return;

                        if (
                            entry.isIntersecting &&
                            entry.intersectionRatio >= 0.7
                        ) {
                            this.pauseAllVideos(video);

                            video.play()
                                .catch(() => {});
                        } else {
                            video.pause();
                        }
                    });
                },
                {
                    root: feed,
                    threshold: [0.25, 0.5, 0.7, 0.9]
                }
            );

        document
            .querySelectorAll(".flip-card")
            .forEach(card => {
                this.observer.observe(card);
            });
    },

    pauseAllVideos(exceptVideo = null) {
        document
            .querySelectorAll(".flip-video")
            .forEach(video => {
                if (video !== exceptVideo) {
                    video.pause();
                }
            });
    }
};


document.addEventListener(
    "DOMContentLoaded",
    () => {
        const flipsButton =
            document.getElementById("flips-nav-btn");

        flipsButton?.addEventListener(
            "click",
            () => {
                FlipsPage.show();
            }
        );

        const homeButton =
            document.getElementById("home-nav-btn");

        homeButton?.addEventListener(
            "click",
            () => {
                FlipsPage.hide();

                document
                    .getElementById("search-results-page")
                    ?.classList.add("hidden");

                document
                    .getElementById("feed-container")
                    ?.classList.remove("hidden");

                document
                    .querySelectorAll(".dock-btn")
                    .forEach(button => {
                        button.classList.remove("active");
                    });

                homeButton.classList.add("active");
            }
        );

        const flipsBackButton =
            document.getElementById("flips-back-btn");

        flipsBackButton?.addEventListener(
            "click",
            () => {

                FlipsPage.hide();

                document
                    .getElementById("flips-page")
                    ?.classList.add("hidden");

                document
                    .getElementById("search-results-page")
                    ?.classList.add("hidden");

                document
                    .getElementById("feed-container")
                    ?.classList.remove("hidden");

                document
                    .querySelectorAll(".dock-btn")
                    .forEach(button => {
                        button.classList.remove("active");
                    });

                document
                    .getElementById("home-nav-btn")
                    ?.classList.add("active");

                history.replaceState(
                    null,
                    "",
                    window.location.pathname
                );
            }
        );
    }
);