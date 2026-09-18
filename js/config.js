(function configureAeroApi() {
    const localApiOrigin = 'http://127.0.0.1:5000';
    const productionApiOrigin = 'https://GOH.pythonanywhere.com';
    const hostname = window.location.hostname;
    const isLocalDevelopment = hostname === '127.0.0.1' || hostname === 'localhost';

    window.AeroConfig = Object.freeze({
        API_ORIGIN: isLocalDevelopment ? localApiOrigin : productionApiOrigin,
        API_BASE_URL: `${isLocalDevelopment ? localApiOrigin : productionApiOrigin}/api`
    });
})();