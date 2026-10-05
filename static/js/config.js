// Browser API origin and runtime configuration
// From: environment and hostname -> To: window.AeroConfig used by all client modules
(function configureAeroApi() {
    const productionApiOrigin = 'https://aero-2620mit.onrender.com';
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const apiOrigin = isLocalHost ? window.location.origin : productionApiOrigin;

    window.AeroConfig = Object.freeze({
        API_ORIGIN: apiOrigin,
        API_BASE_URL: `${apiOrigin}/api`,
        ADMIN_API_BASE: `${apiOrigin}/api/admin`,
        SUPABASE_URL: 'https://tamzlrygqskxscofwnho.supabase.co',
        SUPABASE_ANON_KEY: 'sb_publishable_6aNejtXmFMJ984mqQY2kQA_o0Kuei_4'
    });

    const tokenKeys = ['token', 'aero_token', 'access_token', 'sb-access-token'];
    const getToken = () => tokenKeys.map((key) => localStorage.getItem(key)).find((value) => value && value !== 'null' && value !== 'undefined') || '';
    const setToken = (token) => {
        if (!token) return;
        localStorage.setItem('token', token);
        localStorage.setItem('aero_token', token);
    };
    window.AeroToken = { get: getToken, set: setToken };

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        const requestUrl = typeof input === 'string' ? input : input?.url || '';
        const headers = new Headers(init.headers || (typeof input !== 'string' ? input?.headers : undefined));
        const token = getToken();
        if (token && requestUrl.includes('/api/') && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        return nativeFetch(input, { ...init, headers })
        .then((response) => {
            if (!response.ok) {
                console.error('[Aero API response error]', response.status, response.statusText, input);
            }
            return response;
        })
        .catch((error) => {
            console.error('[Aero API request error]', input, error);
            throw error;
        });
    };

    window.addEventListener('error', (event) => {
        console.error('[Aero frontend error]', event.error || event.message, event.filename || '');
    });
    window.addEventListener('unhandledrejection', (event) => {
        console.error('[Aero unhandled API/client rejection]', event.reason);
    });
})();