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

    const theme =
        document.getElementById(
            "theme"
        );


    function applyTheme(themeValue) {

        let finalTheme =
            themeValue;


        if (themeValue === "system") {

            finalTheme =
                window.matchMedia(
                    "(prefers-color-scheme: dark)"
                ).matches
                    ? "dark"
                    : "light";

        }


        document.body.classList.toggle(
            "dark",
            finalTheme === "dark"
        );

    }


    theme.addEventListener(
        "change",
        () => {

            const settings =
                getSettings();


            settings.theme =
                theme.value;


            saveSettings(
                settings
            );


            applyTheme(
                settings.theme
            );


            showToast(
                "Theme updated"
            );

        }
    );



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
       PROFILE
    ========================================== */

    const username =
        document.getElementById(
            "username"
        );


    const email =
        document.getElementById(
            "email"
        );


    const bio =
        document.getElementById(
            "bio"
        );


    const bioCount =
        document.getElementById(
            "bio-count"
        );


    function updateBioCount() {

        bioCount.textContent =
            `${bio.value.length} / 150`;

    }


    bio.addEventListener(
        "input",
        updateBioCount
    );


    function getStoredUser() {

        const keys = [

            "aero_user",

            "currentUser"

        ];


        for (const key of keys) {

            try {

                const user =
                    JSON.parse(
                        localStorage.getItem(
                            key
                        )
                    );


                if (user) {

                    return user;

                }

            } catch {}

        }


        return null;

    }


    function loadUser() {

        const user =
            getStoredUser();


        if (!user) {

            return;

        }


        username.value =
            user.username || "";


        email.value =
            user.email || "";


        bio.value =
            user.bio || "";


        document.getElementById(
            "profile-name"
        ).textContent =
            user.username || "User";


        document.getElementById(
            "profile-email-display"
        ).textContent =
            user.email || "";


        const avatar =
            document.getElementById(
                "profile-avatar"
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
                (
                    user.username ||
                    "U"
                )
                .charAt(0)
                .toUpperCase();

        }


        updateBioCount();

    }


    loadUser();


    /* =========================================
       SAVE PROFILE
    ========================================== */

    document
        .getElementById("save-profile")
        .addEventListener(
            "click",
            () => {

                const existingUser =
                    getStoredUser() || {};


                const user = {

                    ...existingUser,

                    username:
                        username.value.trim(),

                    email:
                        email.value.trim(),

                    bio:
                        bio.value.trim()

                };


                localStorage.setItem(
                    "aero_user",
                    JSON.stringify(user)
                );


                document.getElementById(
                    "profile-name"
                ).textContent =
                    user.username ||
                    "User";


                document.getElementById(
                    "profile-email-display"
                ).textContent =
                    user.email ||
                    "";


                showToast(
                    "Profile saved"
                );

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
       LOGOUT
    ========================================== */

    document
        .getElementById("logout-button")
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