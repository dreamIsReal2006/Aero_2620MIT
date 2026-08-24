document.addEventListener("DOMContentLoaded", () => {

    /* =========================================
       STORAGE
    ========================================== */

    const DEFAULT_SETTINGS = {

        theme: "light",

        compactMode: false,

        pushNotifications: true,

        likeNotifications: true,

        commentNotifications: true,

        followNotifications: true,

        privateAccount: false,

        onlineStatus: true

    };


    function getSettings() {

        try {

            const saved =
                JSON.parse(
                    localStorage.getItem(
                        "aero_settings"
                    )
                );

            return {
                ...DEFAULT_SETTINGS,
                ...(saved || {})
            };

        } catch {

            return {
                ...DEFAULT_SETTINGS
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
    ========================================== */

    function showToast(message) {

        const toast =
            document.getElementById("toast");

        const text =
            document.getElementById(
                "toast-message"
            );


        text.textContent = message;

        toast.classList.add("show");


        clearTimeout(
            window.aeroToastTimer
        );


        window.aeroToastTimer =
            setTimeout(() => {

                toast.classList.remove(
                    "show"
                );

            }, 2200);

    }


    /* =========================================
       SETTINGS PAGE NAVIGATION
    ========================================== */

    const links =
        document.querySelectorAll(
            ".settings-link"
        );


    const pages =
        document.querySelectorAll(
            ".settings-page"
        );


    function getCurrentPage() {

        return (
            window.location.hash
                .replace("#", "")
                .trim()
            || "account"
        );

    }


    function showPage(
        pageName,
        addHistory = true
    ) {

        const page =
            document.getElementById(
                `page-${pageName}`
            );


        const link =
            document.querySelector(
                `[data-page="${pageName}"]`
            );


        /*
         * Invalid page
         */

        if (!page || !link) {

            pageName = "account";

            return showPage(
                pageName,
                addHistory
            );

        }


        /*
         * Hide pages
         */

        pages.forEach(page => {

            page.classList.remove(
                "active"
            );

        });


        /*
         * Remove active links
         */

        links.forEach(link => {

            link.classList.remove(
                "active"
            );

        });


        /*
         * Show selected page
         */

        page.classList.add(
            "active"
        );


        link.classList.add(
            "active"
        );


        /*
         * Update URL WITHOUT reload
         */

        if (addHistory) {

            history.pushState(
                {
                    page: pageName
                },
                "",
                `#${pageName}`
            );

        }

    }


    /*
     * Sidebar clicks
     */

    links.forEach(link => {

        link.addEventListener(
            "click",
            () => {

                showPage(
                    link.dataset.page
                );

            }
        );

    });


    /*
     * Browser Back / Forward
     */

    window.addEventListener(
        "popstate",
        () => {

            showPage(
                getCurrentPage(),
                false
            );

        }
    );


    /*
     * Handle hash changes
     */

    window.addEventListener(
        "hashchange",
        () => {

            showPage(
                getCurrentPage(),
                false
            );

        }
    );


    /*
     * Initial page
     */

    showPage(
        getCurrentPage(),
        false
    );



    /* =========================================
       THEME
    ========================================== */

    /* =========================================
   APPEARANCE
========================================= */

const themeSelect =
    document.getElementById("theme");

const compactMode =
    document.getElementById(
        "compact-mode"
    );


/*
 * Apply theme
 */

function applyTheme(theme) {

    if (theme === "dark") {

        document.body.classList.add(
            "dark"
        );

        return;

    }


    if (theme === "light") {

        document.body.classList.remove(
            "dark"
        );

        return;

    }


    /*
     * System theme
     */

    const systemDark =
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;


    document.body.classList.toggle(
        "dark",
        systemDark
    );

}


/*
 * Load saved appearance
 */

function loadAppearance() {

    const savedTheme =
        localStorage.getItem(
            "aero_theme"
        ) || "system";


    const savedCompact =
        localStorage.getItem(
            "aero_compact"
        ) === "true";


    themeSelect.value =
        savedTheme;


    compactMode.checked =
        savedCompact;


    applyTheme(
        savedTheme
    );


    document.body.classList.toggle(
        "compact",
        savedCompact
    );

}


/*
 * Change theme
 */

themeSelect.addEventListener(
    "change",
    () => {

        const theme =
            themeSelect.value;


        localStorage.setItem(
            "aero_theme",
            theme
        );


        applyTheme(
            theme
        );


        showToast(
            "Theme updated"
        );

    }
);


/*
 * Compact mode
 */

compactMode.addEventListener(
    "change",
    () => {

        const enabled =
            compactMode.checked;


        localStorage.setItem(
            "aero_compact",
            enabled
        );


        document.body.classList.toggle(
            "compact",
            enabled
        );


        showToast(
            enabled
                ? "Compact mode enabled"
                : "Compact mode disabled"
        );

    }
);


/*
 * If system theme changes
 */

window
    .matchMedia(
        "(prefers-color-scheme: dark)"
    )
    .addEventListener(
        "change",
        () => {

            if (
                themeSelect.value ===
                "system"
            ) {

                applyTheme(
                    "system"
                );

            }

        }
    );


loadAppearance();


    /* =========================================
       TOGGLE SETTINGS
    ========================================== */

    const toggleMap = {

        "compact-mode":
            "compactMode",

        "push-notifications":
            "pushNotifications",

        "like-notifications":
            "likeNotifications",

        "comment-notifications":
            "commentNotifications",

        "follow-notifications":
            "followNotifications",

        "private-account":
            "privateAccount",

        "online-status":
            "onlineStatus"

    };


    Object.entries(toggleMap)
        .forEach(
            ([elementId, settingName]) => {

                const element =
                    document.getElementById(
                        elementId
                    );


                if (!element) return;


                element.addEventListener(
                    "change",
                    () => {

                        const settings =
                            getSettings();


                        settings[settingName] =
                            element.checked;


                        saveSettings(
                            settings
                        );


                        if (
                            settingName ===
                            "compactMode"
                        ) {

                            document.body.classList.toggle(
                                "compact",
                                element.checked
                            );

                        }


                        showToast(
                            element.checked
                                ? "Setting enabled"
                                : "Setting disabled"
                        );

                    }
                );

            }
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

const profileName =
    document.getElementById("profile-name");

const profileEmail =
    document.getElementById(
        "profile-email-display"
    );

const profileAvatar =
    document.getElementById(
        "profile-avatar"
    );

const bioCount =
    document.getElementById("bio-count");


/*
 * Update bio character counter
 */

bioInput.addEventListener(
    "input",
    () => {

        bioCount.textContent =
            `${bioInput.value.length} / 150`;

    }
);


/*
 * Load account information
 */

async function loadAccount() {

    try {

        const response =
            await fetch(
                "/api/account",
                {
                    method: "GET",

                    credentials: "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                "Unable to load account"
            );

        }


        const user =
            await response.json();


        usernameInput.value =
            user.username || "";


        emailInput.value =
            user.email || "";


        bioInput.value =
            user.bio || "";


        profileName.textContent =
            user.username || "User";


        profileEmail.textContent =
            user.email || "";


        if (user.avatar_url) {

            profileAvatar.style.backgroundImage =
                `url("${user.avatar_url}")`;

            profileAvatar.style.backgroundSize =
                "cover";

            profileAvatar.style.backgroundPosition =
                "center";

            profileAvatar.textContent =
                "";

        } else {

            profileAvatar.textContent =
                (
                    user.username ||
                    "U"
                )
                .charAt(0)
                .toUpperCase();

        }


        bioCount.textContent =
            `${bioInput.value.length} / 150`;

    }

    catch (error) {

        console.error(error);

        showToast(
            "Unable to load account information"
        );

    }

}


/*
 * Save account
 */

document
    .getElementById("save-profile")
    .addEventListener(
        "click",
        async () => {

            const username =
                usernameInput.value.trim();

            const bio =
                bioInput.value.trim();


            if (!username) {

                showToast(
                    "Username cannot be empty"
                );

                return;

            }


            try {

                const button =
                    document.getElementById(
                        "save-profile"
                    );


                button.disabled = true;

                button.textContent =
                    "Saving...";


                const response =
                    await fetch(
                        "/api/account",
                        {
                            method: "PUT",

                            credentials: "include",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({

                                username:
                                    username,

                                bio:
                                    bio

                            })

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Unable to update account"
                    );

                }


                profileName.textContent =
                    username;


                showToast(
                    "Account updated successfully"
                );

            }

            catch (error) {

                console.error(error);

                showToast(
                    error.message ||
                    "Failed to update account"
                );

            }

            finally {

                const button =
                    document.getElementById(
                        "save-profile"
                    );


                button.disabled = false;

                button.textContent =
                    "Save Changes";

            }

        }
    );


    /* =========================================
       PASSWORD MODAL
    ========================================== */

    const passwordModal =
        document.getElementById(
            "password-modal"
        );


    document
        .getElementById("change-password")
        .addEventListener(
            "click",
            () => {

                passwordModal.classList.remove(
                    "hidden"
                );

            }
        );


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


    document
        .getElementById("update-password")
        .addEventListener(
            "click",
            () => {

                const current =
                    document.getElementById(
                        "current-password"
                    ).value;


                const newPassword =
                    document.getElementById(
                        "new-password"
                    ).value;


                const confirmation =
                    document.getElementById(
                        "confirm-password"
                    ).value;


                if (
                    !current ||
                    !newPassword ||
                    !confirmation
                ) {

                    showToast(
                        "Please fill in all fields"
                    );

                    return;

                }


                if (
                    newPassword.length < 8
                ) {

                    showToast(
                        "Password must contain at least 8 characters"
                    );

                    return;

                }


                if (
                    newPassword !==
                    confirmation
                ) {

                    showToast(
                        "Passwords do not match"
                    );

                    return;

                }


                /*
                 * Backend integration should go here.
                 *
                 * Do NOT store passwords in localStorage.
                 */

                passwordModal.classList.add(
                    "hidden"
                );


                document.getElementById(
                    "current-password"
                ).value = "";


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



    /* =========================================
       ACTIVE SESSIONS
    ========================================== */

    document
        .getElementById("view-sessions")
        .addEventListener(
            "click",
            () => {

                showToast(
                    "You are currently signed in on this device"
                );

            }
        );



    /* =========================================
       DELETE ACCOUNT
    ========================================== */

    const deleteModal =
        document.getElementById(
            "delete-modal"
        );


    document
        .getElementById("delete-account")
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
            async () => {

                /*
                 * IMPORTANT:
                 *
                 * Replace this with your
                 * DELETE /api/account request
                 * when the backend endpoint exists.
                 */


                localStorage.removeItem(
                    "aero_user"
                );


                localStorage.removeItem(
                    "currentUser"
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
       LOGOUT CONFIRMATION
    ========================================== */

    const logoutModal =
        document.getElementById(
            "logout-modal"
        );


    /*
     * Open confirmation
     */

    document
        .getElementById("logout-button")
        .addEventListener(
            "click",
            () => {

                logoutModal.classList.remove(
                    "hidden"
                );

            }
        );


    /*
     * Close with X
     */

    document
        .getElementById("close-logout")
        .addEventListener(
            "click",
            () => {

                logoutModal.classList.add(
                    "hidden"
                );

            }
        );


    /*
     * Cancel
     */

    document
        .getElementById("cancel-logout")
        .addEventListener(
            "click",
            () => {

                logoutModal.classList.add(
                    "hidden"
                );

            }
        );


    /*
     * Confirm logout
     */

    document
        .getElementById("confirm-logout")
        .addEventListener(
            "click",
            () => {

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


                window.location.href =
                    "index.html";

            }
        );



    /* =========================================
       INITIALISE SETTINGS
    ========================================== */

    const settings =
        getSettings();


    theme.value =
        settings.theme;


    Object.entries(toggleMap)
        .forEach(
            ([elementId, settingName]) => {

                const element =
                    document.getElementById(
                        elementId
                    );


                if (element) {

                    element.checked =
                        Boolean(
                            settings[settingName]
                        );

                }

            }
        );


    applyTheme(
        settings.theme
    );


    document.body.classList.toggle(
        "compact",
        settings.compactMode
    );

});