(() => {
    const STORAGE_KEY = 'aero_screen_time';
    const TICK_MS = 1000;
    let usage = readUsage();
    let lastTick = Date.now();
    let isActive = document.visibilityState === 'visible' && document.hasFocus();

    function dayKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function readUsage() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch {
            return {};
        }
    }

    function writeUsage() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
    }

    function recordElapsed() {
        const now = Date.now();
        if (isActive) {
            const elapsed = Math.min(now - lastTick, TICK_MS * 2);
            const key = dayKey();
            usage[key] = (Number(usage[key]) || 0) + elapsed;
            writeUsage();
        }
        lastTick = now;
    }

    function setActive(active) {
        recordElapsed();
        isActive = active;
        lastTick = Date.now();
    }

    function formatDuration(milliseconds) {
        const totalMinutes = Math.floor((Number(milliseconds) || 0) / 60000);
        if (totalMinutes < 1) return '<1m';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    function getUsage() {
        recordElapsed();
        return { ...usage };
    }

    function reset() {
        usage = {};
        writeUsage();
    }

    document.addEventListener('visibilitychange', () => setActive(document.visibilityState === 'visible' && document.hasFocus()));
    window.addEventListener('focus', () => setActive(true));
    window.addEventListener('blur', () => setActive(false));
    window.setInterval(recordElapsed, TICK_MS);

    window.AeroScreenTime = { dayKey, formatDuration, getUsage, reset };
})();
