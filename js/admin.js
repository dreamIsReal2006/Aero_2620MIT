document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('aero_token');
    const user = JSON.parse(localStorage.getItem('aero_user') || '{}');
    const apiBase = window.AeroConfig.ADMIN_API_BASE || `${window.AeroConfig.API_ORIGIN}/api/admin`;
    if (!token || (user.is_admin !== true && !['admin', 'moderator'].includes(user.role))) {
        window.location.href = 'index.html';
        return;
    }

    const errorBox = document.getElementById('admin-error');
    const reportsBody = document.getElementById('admin-reports-body');
    const usersList = document.getElementById('admin-users-list');
    const userSearch = document.getElementById('admin-user-search');
    const appealsList = document.getElementById('admin-appeals-list');
    const isAdminViewer = user.is_admin === true || user.role === 'admin';
    const isModeratorViewer = !isAdminViewer && user.role === 'moderator';
    const dashboardTitle = document.getElementById('admin-dashboard-title');
    const roleBadge = document.getElementById('admin-role-badge');
    if (isModeratorViewer) {
        if (dashboardTitle) dashboardTitle.textContent = 'Moderator Dashboard';
        if (roleBadge) {
            roleBadge.textContent = 'Moderator';
            roleBadge.classList.add('moderator');
        }
    } else if (roleBadge) {
        roleBadge.textContent = 'Admin';
        roleBadge.classList.add('admin');
    }
    const previewModal = document.getElementById('admin-post-preview-modal');
    const previewContent = document.getElementById('admin-post-preview-content');
    const defaultAdminStats = { total_users: 0, total_posts: 0, pending_reports: 0 };
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
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(requestOptions.headers || {}) }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            if ([404, 500, 502, 503, 504].includes(response.status)) {
                if (path === '/stats') return { ...defaultAdminStats };
                if (path === '/reports' || path === '/appeals') return [];
            }
            throw new Error(data.error || data.message || 'Admin request failed');
        }
        return data.data;
    };
    const updateStats = async () => {
        const stats = window.AeroAPI?.getAdminStats
            ? await window.AeroAPI.getAdminStats()
            : await request('/stats');
        document.getElementById('admin-users-count').textContent = stats.total_users;
        document.getElementById('admin-posts-count').textContent = stats.total_posts;
        document.getElementById('admin-reports-count').textContent = stats.pending_reports;
    };
    const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    const renderUsers = users => {
        if (!usersList) return;
        usersList.innerHTML = users.length ? users.map(user => {
            const privilegedTarget = user.is_admin === true || ['admin', 'moderator'].includes(user.role);
            const banDisabled = isModeratorViewer && privilegedTarget ? ' disabled title="Insufficient permissions"' : '';
            return `<div class="admin-user-row" data-user-id="${user.id}" data-username="${escapeHtml(user.username)}" data-role="${escapeHtml(user.role || 'user')}"><strong>@${escapeHtml(user.username)}</strong><span class="admin-user-role">${escapeHtml(user.role || 'user')}</span><span class="admin-user-status">${user.is_banned ? 'Banned' : 'Active'}</span>${isAdminViewer || isModeratorViewer ? `<button class="btn admin-action-btn ban-user-btn" type="button"${banDisabled}>${user.is_banned ? 'Unban' : 'Ban'}</button>${isAdminViewer ? `<div class="role-segmented" role="group" aria-label="Set role for @${escapeHtml(user.username)}"><button class="role-segment ${user.role === 'user' ? 'is-active' : ''}" type="button" data-role="user">User</button><button class="role-segment ${user.role === 'moderator' ? 'is-active' : ''}" type="button" data-role="moderator">Moderator</button><button class="role-segment ${user.role === 'admin' ? 'is-active' : ''}" type="button" data-role="admin">Admin</button></div>` : ''}` : ''}</div>`;
        }).join('') : '<p class="admin-empty">No matching users.</p>';
    };
    const renderAppeals = appeals => {
        if (!appealsList) return;
        appealsList.innerHTML = appeals.map(appeal => `<div class="admin-user-row" data-appeal-id="${appeal.id}"><strong>@${escapeHtml(appeal.username)}</strong><span>${escapeHtml(appeal.content)}</span><button class="btn admin-action-btn appeal-approve-btn" type="button">Approve</button><button class="btn admin-action-btn appeal-reject-btn" type="button">Reject</button></div>`).join('') || '<p class="admin-empty">No pending appeals.</p>';
    };
    const imageUrl = value => value && value.startsWith('http') ? value : `${window.AeroConfig.API_ORIGIN}${value || ''}`;

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
            if (targetUserId && (isAdminViewer || isModeratorViewer)) {
                const banButton = document.createElement('button');
                banButton.className = 'btn admin-action-btn ban-user-btn';
                banButton.type = 'button';
                banButton.textContent = 'Ban User';
                banButton.dataset.userId = String(targetUserId);
                banButton.dataset.reportIds = row.dataset.reportIds;
                if (isModeratorViewer && (group.target?.is_admin === true || ['admin', 'moderator'].includes(group.target?.role))) {
                    banButton.disabled = true;
                    banButton.title = 'Insufficient permissions';
                }
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

    const roleModal = document.getElementById('role-confirm-modal');
    const roleModalTitle = document.getElementById('role-confirm-title');
    const roleModalBody = document.getElementById('role-confirm-body');
    const roleModalConfirm = document.getElementById('confirm-role-change');
    let pendingRoleChange = null;
    const closeRoleModal = () => {
        roleModal?.classList.remove('is-open');
        window.setTimeout(() => roleModal?.classList.add('hidden'), 200);
        pendingRoleChange = null;
    };
    const openRoleModal = (row, role) => {
        pendingRoleChange = { row, role };
        if (roleModalTitle) roleModalTitle.textContent = 'Confirm Role Change';
        if (roleModalBody) roleModalBody.textContent = `Are you sure you want to change @${row.dataset.username}'s role to ${role}?`;
        roleModal?.classList.remove('hidden');
        requestAnimationFrame(() => roleModal?.classList.add('is-open'));
        roleModalConfirm?.focus();
    };

    reportsBody?.addEventListener('click', async event => {
        const deleteButton = event.target.closest('.delete-post-btn');
        const dismissButton = event.target.closest('.dismiss-report-btn');
        const banButton = event.target.closest('.ban-user-btn');
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
                await Promise.all(banButton.dataset.reportIds.split(',').map(id => request(`/reports/${id}/ban-user`, { method: 'POST' })));
                removeRow(row);
            } else return;
            await updateStats();
        } catch (error) { showError(error); }
    });
    let searchTimer;
    let searchRequestId = 0;
    let searchController = null;
    userSearch?.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchController?.abort();
        searchController = null;
        const query = userSearch.value.trim();
        if (!query) {
            searchRequestId += 1;
            renderUsers([]);
            return;
        }
        searchTimer = window.setTimeout(async () => {
            const requestId = ++searchRequestId;
            searchController = new AbortController();
            usersList.innerHTML = '<p class="admin-empty">Searching...</p>';
            try {
                const users = window.AeroAPI?.searchAdminUsers
                    ? await window.AeroAPI.searchAdminUsers(query, searchController.signal)
                    : [];
                if (requestId === searchRequestId) renderUsers(users);
            } finally {
                if (requestId === searchRequestId) {
                    searchController = null;
                }
            }
        }, 300);
    });
    usersList?.addEventListener('click', async event => {
        const button = event.target.closest('.ban-user-btn');
        const roleButton = event.target.closest('.role-segment');
        if (!button && !roleButton) return;
        if (roleButton) {
            const row = roleButton.closest('[data-user-id]');
            if (row.dataset.role !== roleButton.dataset.role) openRoleModal(row, roleButton.dataset.role);
            return;
        }
        const control = button;
        const row = control.closest('[data-user-id]');
        control.disabled = true;
        try {
            if (button) {
                const result = await request(`/users/${row.dataset.userId}/toggle_ban`, { method: 'POST' });
                row.querySelector('.admin-user-status').textContent = result.user.is_banned ? 'Banned' : 'Active';
                button.textContent = result.user.is_banned ? 'Unban' : 'Ban';
            }
        } catch (error) { showError(error); control.disabled = false; }
    });
    roleModal?.addEventListener('click', event => {
        if (event.target === roleModal || event.target.closest('[data-role-modal-close]')) closeRoleModal();
    });
    roleModalConfirm?.addEventListener('click', async () => {
        if (!pendingRoleChange) return;
        const { row, role } = pendingRoleChange;
        roleModalConfirm.disabled = true;
        try {
            await request(`/users/${row.dataset.userId}/role`, { method: 'PATCH', body: { role } });
            row.dataset.role = role;
            row.querySelector('.admin-user-role').textContent = role;
            row.querySelectorAll('.role-segment').forEach(button => button.classList.toggle('is-active', button.dataset.role === role));
            closeRoleModal();
            window.showNotice?.(`@${row.dataset.username} is now a ${role}.`, 'success');
        } catch (error) {
            showError(error);
        } finally {
            roleModalConfirm.disabled = false;
        }
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
