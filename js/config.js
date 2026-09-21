(function configureAeroApi() {
    const productionApiOrigin = 'https://aero-backend.onrender.com';

    window.AeroConfig = Object.freeze({
        API_ORIGIN: productionApiOrigin,
        API_BASE_URL: `${productionApiOrigin}/api`,
        ADMIN_API_BASE: `${productionApiOrigin}/api/admin`,
        SUPABASE_URL: 'https://tamzlrygqskxscofwnho.supabase.co',
        SUPABASE_ANON_KEY: 'sb_publishable_6aNejtXmFMJ984mqQY2kQA_o0Kuei_4'
    });

    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => nativeFetch(input, init)
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

    window.addEventListener('error', (event) => {
        console.error('[Aero frontend error]', event.error || event.message, event.filename || '');
    });
    window.addEventListener('unhandledrejection', (event) => {
        console.error('[Aero unhandled API/client rejection]', event.reason);
    });
})();