(function () {
    const STORAGE_KEY = "aero_screen_time";
    const TICK_INTERVAL = 15000;

    function dayKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function readUsage() {
        try {
            const usage = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            return usage && typeof usage === "object" ? usage : {};
        } catch (error) {
            return {};
        }
    }

    function addActiveTime(milliseconds) {
        if (milliseconds <= 0 || document.hidden) return;
        const usage = readUsage();
        const key = dayKey(new Date());
        usage[key] = Math.max(0, Number(usage[key]) || 0) + milliseconds;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
    }

    let lastActiveAt = Date.now();
    function recordElapsedTime() {
        const now = Date.now();
        if (!document.hidden) addActiveTime(Math.min(now - lastActiveAt, TICK_INTERVAL * 2));
        lastActiveAt = now;
    }

    document.addEventListener("visibilitychange", () => {
        recordElapsedTime();
        lastActiveAt = Date.now();
    });
    window.addEventListener("pagehide", recordElapsedTime);
    window.setInterval(recordElapsedTime, TICK_INTERVAL);

    window.AeroScreenTime = {
        getUsage: readUsage,
        reset: function () {
            localStorage.removeItem(STORAGE_KEY);
        },
        formatDuration: function (milliseconds) {
            const minutes = Math.floor((Number(milliseconds) || 0) / 60000);
            if (minutes < 60) return `${minutes}m`;
            return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
        },
        dayKey
    };
})();
