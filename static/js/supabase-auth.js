(() => {
    const config = window.AeroConfig;
    if (!config || !window.supabase?.createClient) return;

    const supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.AeroSupabase = supabase;

    const notify = (message) => {
        if (window.showNotice) window.showNotice(message, 'error');
        else window.alert(message);
    };
    const redirectTo = `${window.location.origin}/index.html`;

    window.AeroSupabaseSignOut = () => {
        window.AeroStopNotificationRealtime?.();
        return supabase.auth.signOut();
    };

    async function exchangeSession(session) {
        if (!session?.access_token) return false;
        const response = await fetch(`${config.API_BASE_URL}/auth/supabase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: session.access_token })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Unable to complete social sign in');
        localStorage.setItem('aero_token', data.token);
        localStorage.setItem('aero_user', JSON.stringify(data.user));
        window.AeroI18n?.restoreUserLanguage?.(data.user);
        return true;
    }

    async function signIn(provider) {
        const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
        if (error) {
            console.error(`${provider} OAuth sign in failed:`, error.message);
            notify(error.message);
        }
    }

    window.handleGoogleSignIn = () => signIn('google');
    window.handleGithubSignIn = () => signIn('github');

    document.addEventListener('DOMContentLoaded', async () => {
        document.querySelectorAll('[data-social-provider]').forEach((button) => {
            button.addEventListener('click', () => signIn(button.dataset.socialProvider));
        });
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || localStorage.getItem('aero_token')) return;
        try {
            if (await exchangeSession(session)) window.location.reload();
        } catch (error) {
            console.error('Supabase session exchange failed:', error);
            notify(error.message);
        }
    });
})();