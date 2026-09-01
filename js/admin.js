document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('aero_token');
    const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
    const apiBase = window.location.protocol === 'file:' ? 'http://127.0.0.1:5000/api' : `${window.location.origin}/api`;
    if (!token || user.is_admin !== true) {
        window.location.href = 'index.html';
        return;
    }

    const errorBox = document.getElementById('admin-error');
    const reportsBody = document.getElementById('admin-reports-body');
    const previewModal = document.getElementById('admin-post-preview-modal');
    const previewContent = document.getElementById('admin-post-preview-content');
    const showError = error => {
        if (!errorBox) return;
        errorBox.textContent = error.message;
        errorBox.classList.remove('hidden');
    };
    const request = async (path, options = {}) => {
        const response = await fetch(`${apiBase}${path}`, {
            ...options,
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Admin request failed');
        return data;
    };
    const updateStats = async () => {
        const stats = await request('/admin/stats');
        document.getElementById('admin-users-count').textContent = stats.users_count;
        document.getElementById('admin-posts-count').textContent = stats.posts_count;
        document.getElementById('admin-reports-count').textContent = stats.pending_reports_count;
    };
    const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    const imageUrl = value => value && value.startsWith('http') ? value : `${window.location.origin}${value || ''}`;

    const openPreview = post => {
        if (!previewContent || !post) return;
        const images = (post.images || []).map(image => `<img src="${escapeHtml(imageUrl(image))}" alt="Post media">`).join('');
        previewContent.innerHTML = `
            <h2 id="admin-post-preview-title">@${escapeHtml(post.username || 'User')}</h2>
            <time>${escapeHtml(new Date(post.created_at).toLocaleString())}</time>
            ${images ? `<div class="admin-preview-media">${images}</div>` : ''}
            <p>${escapeHtml(post.content || '')}</p>`;
        previewModal?.classList.remove('hidden');
    };
    const closePreview = () => previewModal?.classList.add('hidden');

    const groupReports = reports => {
        const groups = new Map();
        reports.forEach(report => {
            const key = report.target_type === 'post' ? `post:${report.target_id}` : `user:${report.target_id}`;
            if (!groups.has(key)) groups.set(key, { target_type: report.target_type, target_id: report.target_id, target: report.target, reports: [] });
            groups.get(key).reports.push(report);
        });
        return [...groups.values()];
    };

    const createTargetPreview = group => {
        const target = document.createElement('button');
        target.type = 'button';
        target.className = 'admin-target-preview';
        target.dataset.postId = group.target_type === 'post' ? String(group.target_id) : '';
        const post = group.target;
        if (group.target_type !== 'post' || !post) {
            target.textContent = post ? `@${post.username}` : `User #${group.target_id}`;
            return target;
        }
        const avatar = document.createElement('span');
        avatar.className = 'admin-target-avatar';
        if (post.avatar_url) {
            avatar.style.backgroundImage = `url("${escapeHtml(imageUrl(post.avatar_url))}")`;
        } else {
            avatar.textContent = (post.username || 'U').charAt(0).toUpperCase();
        }
        const copy = document.createElement('span');
        copy.className = 'admin-target-copy';
        copy.innerHTML = `<strong>@${escapeHtml(post.username || 'User')}</strong><small>${escapeHtml((post.content || '').slice(0, 30))}${(post.content || '').length > 30 ? '...' : ''}</small>`;
        target.append(avatar, copy);
        if (post.images?.[0]) {
            const image = document.createElement('img');
            image.className = 'admin-target-thumbnail';
            image.src = imageUrl(post.images[0]);
            image.alt = '';
            target.appendChild(image);
        }
        target.addEventListener('click', () => openPreview(post));
        return target;
    };

    const removeRow = row => {
        row?.classList.add('admin-row-removing');
        window.setTimeout(() => {
            row?.remove();
            if (reportsBody && !reportsBody.querySelector('tr')) reportsBody.innerHTML = '<tr><td colspan="4" class="admin-empty">No pending reports.</td></tr>';
        }, 220);
    };

    const renderReports = reports => {
        reportsBody.innerHTML = '';
        const groups = groupReports(reports);
        if (!groups.length) {
            reportsBody.innerHTML = '<tr><td colspan="4" class="admin-empty">No pending reports.</td></tr>';
            return;
        }
        groups.forEach(group => {
            const row = document.createElement('tr');
            row.dataset.targetId = String(group.target_id);
            row.dataset.reportIds = group.reports.map(report => report.id).join(',');
            const reporter = document.createElement('td');
            reporter.innerHTML = `<strong>Total Reports: ${group.reports.length}</strong><div class="admin-reporters">${group.reports.map(report => `<span>@${escapeHtml(report.reporter.username)}</span>`).join('')}</div>`;
            const target = document.createElement('td');
            target.appendChild(createTargetPreview(group));
            target.className = 'admin-target-cell';
            const reason = document.createElement('td');
            reason.className = 'admin-reasons-cell';
            reason.innerHTML = group.reports.map(report => `<div><strong>@${escapeHtml(report.reporter.username)}</strong><span>${escapeHtml(report.reason)}</span></div>`).join('');
            const actions = document.createElement('td');
            actions.className = 'admin-actions-cell';
            if (group.target_type === 'post') {
                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn btn-danger admin-action-btn delete-post-btn';
                deleteButton.type = 'button';
                deleteButton.textContent = 'Delete Post';
                deleteButton.dataset.postId = String(group.target_id);
                deleteButton.dataset.reportIds = row.dataset.reportIds;
                actions.appendChild(deleteButton);
            }
            const dismissButton = document.createElement('button');
            dismissButton.className = 'btn admin-action-btn dismiss-report-btn';
            dismissButton.type = 'button';
            dismissButton.textContent = 'Dismiss';
            dismissButton.dataset.reportIds = row.dataset.reportIds;
            actions.appendChild(dismissButton);
            const targetUserId = group.target_type === 'user' ? group.target_id : group.target?.user_id;
            if (targetUserId) {
                const banButton = document.createElement('button');
                banButton.className = 'btn admin-action-btn';
                banButton.type = 'button';
                banButton.textContent = 'Ban User';
                banButton.dataset.userId = String(targetUserId);
                actions.appendChild(banButton);
            }
            row.append(reporter, target, reason, actions);
            reportsBody.appendChild(row);
        });
    };

    const loadDashboard = async () => {
        errorBox?.classList.add('hidden');
        reportsBody.innerHTML = '<tr><td colspan="4" class="admin-empty">Loading reports...</td></tr>';
        try {
            renderReports(await request('/admin/reports'));
            await updateStats();
        } catch (error) { showError(error); }
    };

    reportsBody?.addEventListener('click', async event => {
        const deleteButton = event.target.closest('.delete-post-btn');
        const dismissButton = event.target.closest('.dismiss-report-btn');
        const banButton = event.target.closest('[data-user-id]');
        const row = event.target.closest('tr');
        try {
            if (deleteButton) {
                deleteButton.disabled = true;
                await request(`/admin/posts/${encodeURIComponent(deleteButton.dataset.postId)}`, { method: 'DELETE' });
                removeRow(row);
            } else if (dismissButton) {
                dismissButton.disabled = true;
                await Promise.all(dismissButton.dataset.reportIds.split(',').map(id => request(`/admin/reports/${id}/dismiss`, { method: 'PATCH' })));
                removeRow(row);
            } else if (banButton) {
                banButton.disabled = true;
                await request(`/admin/users/${banButton.dataset.userId}/ban`, { method: 'POST' });
                await loadDashboard();
            } else return;
            await updateStats();
        } catch (error) { showError(error); }
    });

    document.getElementById('close-admin-post-preview')?.addEventListener('click', closePreview);
    previewModal?.addEventListener('click', event => { if (event.target === previewModal) closePreview(); });
    document.getElementById('admin-refresh')?.addEventListener('click', loadDashboard);
    document.getElementById('admin-logout')?.addEventListener('click', () => {
        localStorage.removeItem('aero_token');
        localStorage.removeItem('aero_user');
        window.location.href = 'index.html';
    });
    await loadDashboard();
});
