(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function getTheme() {
        let value = localStorage.getItem("theme");
        if (!value) {
            try {
                value = JSON.parse(localStorage.getItem("aero_settings") || "{}").theme;
            } catch {
                value = "system";
            }
        }
        return ["light", "dark", "system"].includes(value) ? value : "system";
    }

    function applyTheme(value = getTheme()) {
        const isDark = value === "dark" || (value === "system" && mediaQuery.matches);
        document.documentElement.dataset.theme = isDark ? "dark" : "light";
        document.documentElement.classList.toggle("dark-mode", isDark);
        document.documentElement.classList.toggle("light-mode", !isDark);
        document.body?.classList.toggle("dark-mode", isDark);
        document.body?.classList.toggle("light-mode", !isDark);
        const select = document.getElementById("theme-select");
        if (select && select.value !== value) select.value = value;
    }

    function setTheme(value) {
        const nextValue = ["light", "dark", "system"].includes(value) ? value : "system";
        localStorage.setItem("theme", nextValue);
        localStorage.setItem("aero_settings", JSON.stringify({
            ...readSettings(),
            theme: nextValue
        }));
        applyTheme(nextValue);
    }

    function readSettings() {
        try {
            return JSON.parse(localStorage.getItem("aero_settings") || "{}");
        } catch {
            return {};
        }
    }

    applyTheme();
    mediaQuery.addEventListener?.("change", () => {
        if (getTheme() === "system") applyTheme("system");
    });
    document.addEventListener("DOMContentLoaded", () => {
        applyTheme();
        document.getElementById("theme-select")?.addEventListener("change", (event) => setTheme(event.target.value));
    });

    window.AeroTheme = { applyTheme, setTheme, getTheme };
})();
