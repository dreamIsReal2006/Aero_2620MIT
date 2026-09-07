document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('aero_token');
    const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
    const adminRoute = window.location.pathname.split('/').filter(Boolean).find(segment => segment.startsWith('admin_')) || 'admin_default_fallback';
    const apiBase = window.location.protocol === 'file:'
        ? `http://127.0.0.1:5000/api/${adminRoute}`
        : `${window.location.origin}/api/${adminRoute}`;
    if (!token || (user.is_admin !== true && user.role !== 'admin')) {
        window.location.href = 'index.html';
        return;
    }

    const errorBox = document.getElementById('admin-error');
    const reportsBody = document.getElementById('admin-reports-body');
    const usersList = document.getElementById('admin-users-list');
    const userSearch = document.getElementById('admin-user-search');
    const appealsList = document.getElementById('admin-appeals-list');
    const previewModal = document.getElementById('admin-post-preview-modal');
    const previewContent = document.getElementById('admin-post-preview-content');
    const showError = error => {
        if (!errorBox) return;
        errorBox.textContent = error.message;
        errorBox.classList.remove('hidden');
    };
    const request = async (path, options = {}) => {
        const requestOptions = { ...options };
        if (requestOptions.body && typeof requestOptions.body !== 'string') {
            requestOptions.headers = { 'Content-Type': 'application/json', ...(requestOptions.headers || {}) };
            requestOptions.body = JSON.stringify(requestOptions.body);
        }
        const response = await fetch(`${apiBase}${path}`, {
            ...requestOptions,
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(requestOptions.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) throw new Error(data.error || data.message || 'Admin request failed');
        return data.data;
    };
    const updateStats = async () => {
        const stats = await request('/stats');
        document.getElementById('admin-users-count').textContent = stats.total_users;
        document.getElementById('admin-posts-count').textContent = stats.total_posts;
        document.getElementById('admin-reports-count').textContent = stats.pending_reports;
    };
    const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    const renderUsers = users => {
        if (!usersList) return;
        usersList.innerHTML = users.length ? users.map(user => `<div class="admin-user-row" data-user-id="${user.id}"><strong>@${escapeHtml(user.username)}</strong><span class="admin-user-role">${escapeHtml(user.role || 'user')}</span><span class="admin-user-status">${user.is_banned ? 'Banned' : 'Active'}</span><button class="btn admin-action-btn ban-user-btn" type="button">${user.is_banned ? 'Unban' : 'Ban'}</button><button class="btn admin-action-btn permission-btn" type="button" data-role="${escapeHtml(user.role || 'user')}">${user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}</button></div>`).join('') : '<p class="admin-empty">No matching users.</p>';
    };
    const renderAppeals = appeals => {
        if (!appealsList) return;
        appealsList.innerHTML = appeals.map(appeal => `<div class="admin-user-row" data-appeal-id="${appeal.id}"><strong>@${escapeHtml(appeal.username)}</strong><span>${escapeHtml(appeal.content)}</span><button class="btn admin-action-btn appeal-approve-btn" type="button">Approve</button><button class="btn admin-action-btn appeal-reject-btn" type="button">Reject</button></div>`).join('') || '<p class="admin-empty">No pending appeals.</p>';
    };
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
            renderReports(await request('/reports'));
            renderAppeals(await request('/appeals'));
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
                await request(`/posts/${encodeURIComponent(deleteButton.dataset.postId)}`, { method: 'DELETE' });
                removeRow(row);
            } else if (dismissButton) {
                dismissButton.disabled = true;
                await Promise.all(dismissButton.dataset.reportIds.split(',').map(id => request(`/reports/${id}/dismiss`, { method: 'PATCH' })));
                removeRow(row);
            } else if (banButton) {
                banButton.disabled = true;
                const result = await request(`/users/${banButton.dataset.userId}/toggle_ban`, { method: 'POST' });
                banButton.textContent = result.user.is_banned ? 'Unban' : 'Ban User';
            } else return;
            await updateStats();
        } catch (error) { showError(error); }
    });
    let searchTimer;
    let searchRequestId = 0;
    userSearch?.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        const query = userSearch.value.trim();
        if (!query) {
            searchRequestId += 1;
            renderUsers([]);
            return;
        }
        searchTimer = window.setTimeout(async () => {
            const requestId = ++searchRequestId;
            usersList.innerHTML = '<p class="admin-empty">Searching...</p>';
            try {
                const users = await request(`/search_users?q=${encodeURIComponent(query)}`);
                if (requestId === searchRequestId) renderUsers(users);
            } catch (error) {
                if (requestId === searchRequestId) showError(error);
            }
        }, 300);
    });
    usersList?.addEventListener('click', async event => {
        const button = event.target.closest('.ban-user-btn, .permission-btn');
        if (!button) return;
        const row = button.closest('[data-user-id]');
        button.disabled = true;
        try {
            if (button.classList.contains('ban-user-btn')) {
                const result = await request(`/users/${row.dataset.userId}/toggle_ban`, { method: 'POST' });
                row.querySelector('.admin-user-status').textContent = result.user.is_banned ? 'Banned' : 'Active';
                button.textContent = result.user.is_banned ? 'Unban' : 'Ban';
            } else {
                const isAdmin = button.dataset.role === 'admin';
                const result = await request(`/users/${row.dataset.userId}/${isAdmin ? 'demote' : 'promote'}`, { method: 'POST' });
                const nextRole = result.user.role || 'user';
                row.querySelector('.admin-user-role').textContent = nextRole;
                button.dataset.role = nextRole;
                button.textContent = nextRole === 'admin' ? 'Demote to User' : 'Promote to Admin';
            }
        } catch (error) { showError(error); button.disabled = false; }
    });
    appealsList?.addEventListener('click', async event => {
        const button = event.target.closest('.appeal-approve-btn, .appeal-reject-btn');
        if (!button) return;
        const row = button.closest('[data-appeal-id]');
        try {
            await request(`/appeals/${row.dataset.appealId}/${button.classList.contains('appeal-approve-btn') ? 'approve' : 'reject'}`, { method: 'PATCH' });
            row.remove();
        } catch (error) { showError(error); }
    });

    document.getElementById('close-admin-post-preview')?.addEventListener('click', closePreview);
    previewModal?.addEventListener('click', event => { if (event.target === previewModal) closePreview(); });
    document.getElementById('admin-refresh')?.addEventListener('click', loadDashboard);
    await loadDashboard();
});
