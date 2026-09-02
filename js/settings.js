document.addEventListener("DOMContentLoaded", () => {
    const $ = (selector) => document.querySelector(selector);
    const byId = (id) => document.getElementById(id);
    const API_BASE = window.location.protocol === "file:"
        ? "http://127.0.0.1:5000/api"
        : `${window.location.origin}/api`;

    const token = () => localStorage.getItem("aero_token");

    function clearAuthState() {
        ["aero_token", "token", "aero_user", "currentUser"].forEach((key) => localStorage.removeItem(key));
        sessionStorage.clear();
    }

    function showToast(message) {
        const toast = byId("toast");
        const messageElement = byId("toast-message");
        if (!toast || !messageElement) return;
        messageElement.textContent = message;
        toast.classList.add("show");
        window.clearTimeout(window.toastTimer);
        window.toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2500);
    }

    async function request(path, options = {}) {
        const headers = new Headers(options.headers || {});
        headers.set("Accept", "application/json");
        if (options.body && typeof options.body !== "string") {
            headers.set("Content-Type", "application/json");
            options.body = JSON.stringify(options.body);
        }
        if (token()) headers.set("Authorization", `Bearer ${token()}`);
        const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            clearAuthState();
            window.location.href = "index.html";
            throw new Error("Your session has expired");
        }
        if (!response.ok) throw new Error(data.message || "Request failed");
        return data;
    }

    function applyTheme(theme) {
        let actualTheme = theme;
        if (theme === "system") actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        document.body.classList.toggle("dark-mode", actualTheme === "dark");
        document.body.classList.toggle("light-mode", actualTheme !== "dark");
    }

    function readSettings() {
        try {
            return { theme: "light", ...JSON.parse(localStorage.getItem("aero_settings") || "{}") };
        } catch {
            return { theme: "light" };
        }
    }

    function writeUser(user) {
        localStorage.setItem("aero_user", JSON.stringify(user));
        const username = byId("username");
        const emailInput = byId("email");
        const bio = byId("bio");
        if (username) username.value = user.username || "";
        if (emailInput) emailInput.value = user.email || "";
        if (bio) bio.value = user.bio || "";
        const name = byId("account-name");
        const email = byId("account-email");
        const avatar = byId("account-avatar");
        if (name) name.textContent = user.username || "User";
        if (email) email.textContent = user.email || "";
        if (avatar) {
            if (user.avatar_url) {
                avatar.style.backgroundImage = `url("${user.avatar_url}")`;
                avatar.style.backgroundSize = "cover";
                avatar.style.backgroundPosition = "center";
                avatar.textContent = "";
            } else {
                avatar.style.backgroundImage = "";
                avatar.style.backgroundSize = "";
                avatar.style.backgroundPosition = "";
                avatar.textContent = (user.username || "U").charAt(0).toUpperCase();
            }
        }
        const bioCount = byId("bio-count");
        if (bioCount) bioCount.textContent = `${(user.bio || "").length} / 150`;
        const privateToggle = byId("toggle-private-account");
        const onlineToggle = byId("toggle-online-status");
        if (privateToggle) privateToggle.checked = user.is_private === true;
        if (onlineToggle) onlineToggle.checked = user.show_online_status !== false;
        [
            ["toggle-push-notifications", user.push_notifications !== false],
            ["toggle-notify-likes", user.notify_likes !== false],
            ["toggle-notify-comments", user.notify_comments !== false]
        ].forEach(([id, checked]) => {
            const toggle = byId(id);
            if (toggle) toggle.checked = checked;
        });
    }

    async function loadUser() {
        if (!token()) {
            window.location.href = "index.html";
            return;
        }
        try {
            const data = await request("/users/me/profile");
            writeUser(data.user || {});
            const notificationData = await request("/settings/notifications");
            const settings = notificationData.settings || {};
            [["toggle-push-notifications", settings.push_notifications], ["toggle-notify-likes", settings.likes], ["toggle-notify-comments", settings.comments]].forEach(([id, checked]) => {
                const toggle = byId(id);
                if (toggle && typeof checked === "boolean") toggle.checked = checked;
            });
        } catch (error) {
            showToast(error.message);
        }
    }

    const tabs = document.querySelectorAll(".settings-tab");
    const sections = document.querySelectorAll(".settings-section");
    function showSection(sectionName, updateHistory = true) {
        const section = byId(`section-${sectionName}`) || byId("section-account");
        const activeName = section?.id.replace("section-", "");
        const tab = activeName ? $(`[data-section="${activeName}"]`) : null;
        if (!section || !tab) return;
        sections.forEach((item) => item.classList.toggle("active", item === section));
        tabs.forEach((item) => item.classList.toggle("active", item === tab));
        if (updateHistory) history.pushState({ section: activeName }, "", `#${activeName}`);
    }
    tabs.forEach((tab) => tab.addEventListener("click", () => showSection(tab.dataset.section)));
    window.addEventListener("popstate", () => showSection(location.hash.slice(1) || "account", false));
    showSection(location.hash.slice(1) || "account", false);

    byId("bio")?.addEventListener("input", (event) => {
        const count = byId("bio-count");
        if (count) count.textContent = `${event.target.value.length} / 150`;
    });

    byId("save-account-button")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const username = byId("username")?.value.trim() || "";
        const email = byId("email")?.value.trim() || "";
        const bio = byId("bio")?.value.trim() || "";
        if (!username || !email) return showToast("Username and email are required");
        button.disabled = true;
        try {
            const data = await request("/users/me/profile", { method: "PUT", body: { username, email, bio } });
            writeUser(data.user || {});
            showToast("Account information saved");
        } catch (error) {
            showToast(error.message);
        } finally {
            button.disabled = false;
        }
    });

    const savedSettings = readSettings();
    const themeSelect = byId("theme-select");
    const selectedTheme = window.AeroTheme?.getTheme() || savedSettings.theme || "system";
    if (themeSelect) themeSelect.value = selectedTheme;
    window.AeroTheme?.applyTheme(selectedTheme);
    themeSelect?.addEventListener("change", (event) => {
        window.AeroTheme?.setTheme(event.target.value);
        showToast("Theme updated");
    });

    [
        ["toggle-private-account", "is_private"],
        ["toggle-online-status", "show_online_status"]
    ].forEach(([id, field]) => byId(id)?.addEventListener("change", async (event) => {
        const toggle = event.currentTarget;
        toggle.disabled = true;
        try {
            const otherField = field === "is_private" ? "show_online_status" : "is_private";
            const otherToggle = byId(field === "is_private" ? "toggle-online-status" : "toggle-private-account");
            await request("/settings/privacy", {
                method: "PATCH",
                body: { [field]: toggle.checked, [otherField]: otherToggle?.checked === true }
            });
            const user = JSON.parse(localStorage.getItem("aero_user") || "{}");
            const userField = field === "likes" ? "notify_likes" : field === "comments" ? "notify_comments" : field;
            user[userField] = toggle.checked;
            if (otherToggle) user[otherField] = otherToggle.checked;
            localStorage.setItem("aero_user", JSON.stringify(user));
            showToast("Privacy settings updated");
        } catch (error) {
            toggle.checked = !toggle.checked;
            showToast(error.message);
        } finally {
            toggle.disabled = false;
        }
    }));

    [
        ["toggle-push-notifications", "push_notifications"],
        ["toggle-notify-likes", "likes"],
        ["toggle-notify-comments", "comments"]
    ].forEach(([id, field]) => byId(id)?.addEventListener("change", async (event) => {
        const toggle = event.currentTarget;
        toggle.disabled = true;
        try {
            await request("/settings/notifications", {
                method: "PUT",
                body: { [field]: toggle.checked }
            });
            const user = JSON.parse(localStorage.getItem("aero_user") || "{}");
            user[field] = toggle.checked;
            localStorage.setItem("aero_user", JSON.stringify(user));
            showToast("Notification settings updated");
        } catch (error) {
            toggle.checked = !toggle.checked;
            showToast(error.message);
        } finally {
            toggle.disabled = false;
        }
    }));

    function closeModal(modal) { modal?.classList.add("hidden"); }
    function openModal(modal) { modal?.classList.remove("hidden"); }
    const passwordModal = byId("password-modal");
    byId("change-password-button")?.addEventListener("click", () => openModal(passwordModal));
    byId("close-password")?.addEventListener("click", () => closeModal(passwordModal));
    byId("save-password-button")?.addEventListener("click", async (event) => {
        const current = byId("current-password")?.value || "";
        const next = byId("new-password")?.value || "";
        const confirm = byId("confirm-password")?.value || "";
        const strong = next.length >= 8 && /[A-Z]/.test(next) && /[0-9]/.test(next) && /[^A-Za-z0-9]/.test(next);
        if (!current || !strong || next !== confirm) return showToast("Use the current password and a strong matching new password");
        event.currentTarget.disabled = true;
        try {
            await request("/auth/password", { method: "PUT", body: { old_password: current, new_password: next } });
            closeModal(passwordModal);
            ["current-password", "new-password", "confirm-password"].forEach((id) => { if (byId(id)) byId(id).value = ""; });
            clearAuthState();
            window.location.href = "index.html";
        } catch (error) {
            showToast(error.message);
        } finally {
            event.currentTarget.disabled = false;
        }
    });

    const sessionsModal = byId("sessions-modal");
    const sessionsList = byId("sessions-list");
    function deviceIcon(session) {
        return session.mobile
            ? '<svg class="icon-mobile" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"></rect><path d="M10 5h4M11 18.5h2"></path></svg>'
            : '<svg class="icon-desktop" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>';
    }
    function renderSessions() {
        if (!sessionsList) return;
        const sessions = [{ name: "This device", detail: navigator.userAgent, active: true, mobile: /Mobi|Android/i.test(navigator.userAgent) }];
        try {
            const history = JSON.parse(localStorage.getItem("aero_sessions") || "[]");
            sessions.push(...history.filter((session) => session.id !== "current"));
        } catch (error) {
            // Ignore malformed optional session history.
        }
        sessionsList.innerHTML = sessions.map((session, index) => `
            <div class="session-item">
                <span class="session-icon">${deviceIcon(session)}</span>
                <span class="session-copy"><strong>${session.name || "Unknown device"}</strong><small>${session.detail || "Aero session"}</small></span>
                ${session.active ? '<span class="session-badge">Active Now</span>' : `<button class="secondary-button revoke-session" type="button" data-session-index="${index}">Revoke</button>`}
            </div>
        `).join("");
        sessionsList.querySelectorAll(".revoke-session").forEach((button) => button.addEventListener("click", () => {
            const index = Number(button.dataset.sessionIndex);
            sessions.splice(index, 1);
            localStorage.setItem("aero_sessions", JSON.stringify(sessions.slice(1)));
            renderSessions();
            showToast("Session revoked");
        }));
    }
    byId("sessions-button")?.addEventListener("click", () => { renderSessions(); openModal(sessionsModal); });
    byId("close-sessions")?.addEventListener("click", () => closeModal(sessionsModal));
    const deleteModal = byId("delete-modal");
    byId("delete-account-button")?.addEventListener("click", () => openModal(deleteModal));
    ["close-delete", "cancel-delete"].forEach((id) => byId(id)?.addEventListener("click", () => closeModal(deleteModal)));
    byId("confirm-delete")?.addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        try {
            await request("/auth/account", { method: "DELETE" });
            clearAuthState();
            window.location.href = "index.html";
        } catch (error) {
            showToast(error.message);
            event.currentTarget.disabled = false;
        }
    });

    byId("back-button")?.addEventListener("click", () => { window.location.href = "index.html"; });
    document.querySelectorAll(".modal-overlay").forEach((modal) => modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal);
    }));
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(closeModal);
    });

    loadUser();
});
