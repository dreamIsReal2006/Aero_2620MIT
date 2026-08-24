document.addEventListener("DOMContentLoaded", () => {

/* =========================================
       ELEMENTS
    ========================================= */

const tabs =
        document.querySelectorAll(".settings-tab");

const sections =
        document.querySelectorAll(".settings-section");

/* =========================================
       SETTINGS STORAGE
    ========================================= */

const defaultSettings = {
        theme: "light",
        compactMode: false
    };

function getSettings() {

try {

const saved =
                JSON.parse(
                    localStorage.getItem("aero_settings")
                );

return {
                ...defaultSettings,
                ...(saved || {})
            };

} catch {

return {
                ...defaultSettings
            };

}
    }

function saveSettings(settings) {

localStorage.setItem(
            "aero_settings",
            JSON.stringify(settings)
        );

}

/* =========================================
       TOAST
    ========================================= */

function showToast(message) {

const toast =
            document.getElementById("toast");

const messageElement =
            document.getElementById("toast-message");

messageElement.textContent = message;

toast.classList.add("show");

clearTimeout(window.toastTimer);

window.toastTimer =
            setTimeout(() => {

toast.classList.remove("show");

}, 2500);
    }

/* =========================================
       SETTINGS SECTION NAVIGATION
       NO PAGE REFRESH
    ========================================= */

function showSection(
        sectionName,
        updateHistory = true
    ) {

const section =
            document.getElementById(
                `section-${sectionName}`
            );

const tab =
            document.querySelector(
                `[data-section="${sectionName}"]`
            );

if (!section || !tab) {

sectionName = "account";

return showSection(
                sectionName,
                updateHistory
            );

}

sections.forEach(item => {

item.classList.remove("active");

});

tabs.forEach(item => {

item.classList.remove("active");

});

section.classList.add("active");

tab.classList.add("active");

if (updateHistory) {

history.pushState(
                {
                    section: sectionName
                },
                "",
                `#${sectionName}`
            );

}

}

tabs.forEach(tab => {

tab.addEventListener("click", () => {

showSection(
                tab.dataset.section
            );

});

});

/* Browser Back / Forward */

window.addEventListener(
        "popstate",
        () => {

const section =
                window.location.hash
                    .replace("#", "");

showSection(
                section || "account",
                false
            );

}
    );

/* Initial section */

const initialSection =
        window.location.hash
            .replace("#", "");

showSection(
        initialSection || "account",
        false
    );

/* =========================================
       ACCOUNT
    ========================================= */

const usernameInput =
        document.getElementById("username");

const emailInput =
        document.getElementById("email");

const bioInput =
        document.getElementById("bio");

const bioCount =
        document.getElementById("bio-count");

function updateBioCount() {

bioCount.textContent =
            `${bioInput.value.length} / 150`;

}

bioInput.addEventListener(
        "input",
        updateBioCount
    );

function loadUser() {

let user = null;

/*
         * Try the storage used by the Aero
         * frontend.
         */

try {

user =
                JSON.parse(
                    localStorage.getItem(
                        "aero_user"
                    )
                );

} catch {

user = null;

}

if (!user) {

try {

user =
                    JSON.parse(
                        localStorage.getItem(
                            "currentUser"
                        )
                    );

} catch {

user = null;

}

}

if (!user) {

updateBioCount();

return;

}

usernameInput.value =
            user.username || "";

emailInput.value =
            user.email || "";

bioInput.value =
            user.bio || "";

document.getElementById(
            "account-name"
        ).textContent =
            user.username || "User";

document.getElementById(
            "account-email"
        ).textContent =
            user.email || "";

const avatar =
            document.getElementById(
                "account-avatar"
            );

if (user.avatar_url) {

avatar.style.backgroundImage =
                `url("${user.avatar_url}")`;

avatar.style.backgroundSize =
                "cover";

avatar.style.backgroundPosition =
                "center";

avatar.textContent = "";

} else {

avatar.textContent =
                (user.username || "U")
                    .charAt(0)
                    .toUpperCase();

}

updateBioCount();

}

loadUser();

/* Save Account */

document
        .getElementById("save-account-button")
        .addEventListener(
            "click",
            () => {

let user = {};

try {

user =
                        JSON.parse(
                            localStorage.getItem(
                                "aero_user"
                            )
                        ) || {};

} catch {

user = {};

}

user.username =
                    usernameInput.value.trim();

user.email =
                    emailInput.value.trim();

user.bio =
                    bioInput.value.trim();

localStorage.setItem(
                    "aero_user",
                    JSON.stringify(user)
                );

document.getElementById(
                    "account-name"
                ).textContent =
                    user.username || "User";

document.getElementById(
                    "account-email"
                ).textContent =
                    user.email || "";

const avatar =
                    document.getElementById(
                        "account-avatar"
                    );

avatar.textContent =
                    (
                        user.username || "U"
                    )
                        .charAt(0)
                        .toUpperCase();

showToast(
                    "Account information saved"
                );

}
        );

/* =========================================
       APPEARANCE
    ========================================= */

const themeSelect =
        document.getElementById(
            "theme-select"
        );

const compactMode =
        document.getElementById(
            "compact-mode"
        );

function applyTheme(theme) {

let actualTheme = theme;

if (theme === "system") {

actualTheme =
                window.matchMedia(
                    "(prefers-color-scheme: dark)"
                ).matches
                    ? "dark"
                    : "light";

}

document.body.classList.toggle(
            "dark-mode",
            actualTheme === "dark"
        );

}

themeSelect.addEventListener(
        "change",
        () => {

const settings =
                getSettings();

settings.theme =
                themeSelect.value;

saveSettings(settings);

applyTheme(
                settings.theme
            );

showToast(
                "Theme updated"
            );

}
    );

compactMode.addEventListener(
        "change",
        () => {

const settings =
                getSettings();

settings.compactMode =
                compactMode.checked;

saveSettings(settings);

document.body.classList.toggle(
                "compact-mode",
                compactMode.checked
            );

showToast(
                compactMode.checked
                    ? "Compact mode enabled"
                    : "Compact mode disabled"
            );

}
    );

const savedSettings =
        getSettings();

themeSelect.value =
        savedSettings.theme;

compactMode.checked =
        savedSettings.compactMode;

document.body.classList.toggle(
        "compact-mode",
        savedSettings.compactMode
    );

applyTheme(
        savedSettings.theme
    );

/* =========================================
       SECURITY
    ========================================= */

const passwordModal =
        document.getElementById(
            "password-modal"
        );

/* Open Change Password */

document
        .getElementById("change-password-button")
        .addEventListener(
            "click",
            () => {

passwordModal.classList.remove(
                    "hidden"
                );

}
        );

/* Close Change Password */

document
        .getElementById("close-password")
        .addEventListener(
            "click",
            () => {

passwordModal.classList.add(
                    "hidden"
                );

}
        );

/* Save Password */

document
        .getElementById("save-password-button")
        .addEventListener(
            "click",
            () => {

const newPassword =
                    document.getElementById(
                        "new-password"
                    ).value;

const confirmPassword =
                    document.getElementById(
                        "confirm-password"
                    ).value;

if (!newPassword) {

showToast(
                        "Please enter a password"
                    );

return;

}

if (newPassword.length < 8) {

showToast(
                        "Password must be at least 8 characters"
                    );

return;

}

if (
                    newPassword !==
                    confirmPassword
                ) {

showToast(
                        "Passwords do not match"
                    );

return;

}

/*
                 * Frontend placeholder.
                 *
                 * Connect this to the Flask
                 * password endpoint later.
                 */

passwordModal.classList.add(
                    "hidden"
                );

document.getElementById(
                    "new-password"
                ).value = "";

document.getElementById(
                    "confirm-password"
                ).value = "";

showToast(
                    "Password update requested"
                );

}
        );

/* Active Sessions */

document
        .getElementById("sessions-button")
        .addEventListener(
            "click",
            () => {

showToast(
                    "Session management coming soon"
                );

}
        );

/* =========================================
       DELETE ACCOUNT
    ========================================= */

const deleteModal =
        document.getElementById(
            "delete-modal"
        );

document
        .getElementById("delete-account-button")
        .addEventListener(
            "click",
            () => {

deleteModal.classList.remove(
                    "hidden"
                );

}
        );

document
        .getElementById("close-delete")
        .addEventListener(
            "click",
            () => {

deleteModal.classList.add(
                    "hidden"
                );

}
        );

document
        .getElementById("cancel-delete")
        .addEventListener(
            "click",
            () => {

deleteModal.classList.add(
                    "hidden"
                );

}
        );

document
        .getElementById("confirm-delete")
        .addEventListener(
            "click",
            () => {

/*
                 * IMPORTANT:
                 *
                 * This is currently frontend-only.
                 * Do NOT use this as the real
                 * account deletion mechanism.
                 *
                 * Connect it to the backend
                 * DELETE /api/account endpoint.
                 */

localStorage.removeItem(
                    "aero_user"
                );

localStorage.removeItem(
                    "currentUser"
                );

localStorage.removeItem(
                    "aero_settings"
                );

localStorage.removeItem(
                    "aero_token"
                );

localStorage.removeItem(
                    "token"
                );

sessionStorage.clear();

window.location.href =
                    "index.html";

}
        );

/* =========================================
       SIGN OUT CONFIRMATION
    ========================================= */

const signOutModal =
        document.getElementById(
            "sign-out-modal"
        );

/*
     * Open confirmation
     */

document
        .getElementById("sign-out-button")
        .addEventListener(
            "click",
            () => {

signOutModal.classList.remove(
                    "hidden"
                );

}
        );

/*
     * Close confirmation
     */

document
        .getElementById("close-sign-out")
        .addEventListener(
            "click",
            () => {

signOutModal.classList.add(
                    "hidden"
                );

}
        );

document
        .getElementById("cancel-sign-out")
        .addEventListener(
            "click",
            () => {

signOutModal.classList.add(
                    "hidden"
                );

}
        );

/*
     * Confirm Sign Out
     */

document
        .getElementById("confirm-sign-out")
        .addEventListener(
            "click",
            () => {

/*
                 * Remove authentication/session data.
                 */

localStorage.removeItem(
                    "aero_token"
                );

localStorage.removeItem(
                    "token"
                );

localStorage.removeItem(
                    "aero_user"
                );

localStorage.removeItem(
                    "currentUser"
                );

sessionStorage.clear();

/*
                 * Return to login/home page.
                 */

window.location.href =
                    "index.html";

}
        );

/* =========================================
       BACK BUTTON
    ========================================= */

document
        .getElementById("back-button")
        .addEventListener(
            "click",
            () => {

/*
                 * Go back to the previous page.
                 */

if (document.referrer) {

window.history.back();

} else {

window.location.href =
                        "index.html";

}

}
        );

});