(() => {
    const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000/api' : `${window.location.origin}/api`;
    const escapeText = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
    let resetCode = '';
    let resetTimer;

    function showStep(step) {
        document.querySelectorAll('[data-forgot-step]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.forgotStep !== step));
    }

    function closeForgotModal() {
        document.getElementById('forgot-password-modal')?.classList.add('hidden');
        window.clearInterval(resetTimer);
    }

    function startCountdown() {
        let remaining = 600;
        const counter = document.getElementById('forgot-countdown');
        window.clearInterval(resetTimer);
        resetTimer = window.setInterval(() => {
            remaining -= 1;
            if (counter) counter.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
            if (remaining <= 0) window.clearInterval(resetTimer);
        }, 1000);
    }

    async function sendJson(path, body) {
        const response = await fetch(`${apiBase}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Request failed');
        return data;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('forgot-password-modal');
        const accountForm = document.getElementById('forgot-account-form');
        const codeForm = document.getElementById('forgot-code-form');
        const resetForm = document.getElementById('reset-password-form');
        document.querySelector('.forgot-link')?.addEventListener('click', (event) => {
            event.preventDefault();
            modal?.classList.remove('hidden');
            showStep('account');
            document.getElementById('forgot-identifier')?.focus();
        });
        document.getElementById('close-forgot-password')?.addEventListener('click', closeForgotModal);
        modal?.addEventListener('click', (event) => { if (event.target === modal) closeForgotModal(); });

        accountForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const identifier = document.getElementById('forgot-identifier').value.trim();
            if (!identifier) return;
            const button = accountForm.querySelector('button[type="submit"]');
            button.disabled = true;
            try {
                await sendJson('/auth/forgot-password', { identifier });
                showStep('code');
                startCountdown();
                document.getElementById('forgot-code')?.focus();
            } catch (error) {
                document.getElementById('forgot-feedback').textContent = error.message;
            } finally { button.disabled = false; }
        });

        codeForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            resetCode = document.getElementById('forgot-code').value.trim();
            if (!/^\d{6}$/.test(resetCode)) return;
            try {
                await sendJson('/auth/verify-reset-otp', { code: resetCode });
                showStep('password');
                document.getElementById('new-password')?.focus();
            } catch (error) { document.getElementById('forgot-feedback').textContent = error.message; }
        });

        resetForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = document.getElementById('new-password').value;
            const confirmation = document.getElementById('confirm-new-password').value;
            if (password !== confirmation) {
                document.getElementById('forgot-feedback').textContent = 'Passwords do not match';
                return;
            }
            try {
                await sendJson('/auth/reset-password', { code: resetCode, new_password: password });
                closeForgotModal();
                window.alert('Password reset successfully. You can now sign in.');
            } catch (error) { document.getElementById('forgot-feedback').textContent = error.message; }
        });
    });
})();
