(() => {
    const STORAGE_KEY = 'aero_language';
    const originalTitle = document.title;
    const translations = {
        zh: {
            'Settings': '设置', 'Back': '返回', 'Account': '账户', 'Appearance': '外观', 'Languages': '语言',
            'Notifications': '通知', 'Privacy': '隐私', 'Security': '安全', 'Screen Time': '屏幕使用时间',
            'Theme': '主题', 'Light': '浅色', 'Dark': '深色', 'System': '跟随系统', 'App Language': '应用语言',
            'Choose the language you prefer to use in Aero.': '选择 Aero 的显示语言。', 'English': '英文', 'Chinese': '中文',
            'Save Changes': '保存更改', 'Username': '用户名', 'Email': '邮箱', 'Bio': '个人简介', 'User': '用户',
            'Notifications': '通知', 'Push Notifications': '推送通知', 'Receive notifications from Aero.': '接收来自 Aero 的通知。',
            'Likes': '点赞', 'Comments': '评论', 'Notify me when someone likes my post.': '有人点赞我的帖子时通知我。',
            'Notify me when someone comments.': '有人评论我的帖子时通知我。', 'Private Account': '私密账户',
            'Only approved users can view your posts.': '只有获批准的用户可以查看你的帖子。', 'Online Status': '在线状态',
            'Allow other users to see your online status.': '允许其他用户查看你的在线状态。', 'Change Password': '修改密码',
            'Active Sessions': '活跃会话', 'View Sessions': '查看会话', 'Delete Account': '删除账户',
            'Today': '今天', 'Daily average': '日均', 'last 7 days': '最近 7 天', 'Reset Screen Time': '重置屏幕时间',
            'Only time while Aero is open and visible is counted.': '仅统计 Aero 页面打开且可见时的使用时间。',
            'Home': '主页', 'Short videos': '短视频', 'Chat': '聊天', 'Bookmarks': '收藏', 'Search': '搜索', 'For You': '推荐',
            'Search contacts': '搜索联系人', 'Messages': '消息', 'Select a contact': '选择联系人', 'Message...': '消息...',
            'Share what\'s on your mind...': '分享你的想法...', 'Add media': '添加媒体', 'Create post': '创建帖子',
            'Post': '发布', 'Cancel': '取消', 'Delete': '删除', 'Follow': '关注', 'Following': '已关注',
            'Send': '发送', 'Comments': '评论', 'No contacts yet.': '暂无联系人。', 'No notifications yet.': '暂无通知。',
            'Search by username or email': '按用户名或邮箱搜索', 'Hello !': '你好！', 'Welcome': '欢迎',
            'Create Account': '创建账户', 'Sign In': '登录', 'Continue': '继续', 'Forgot?': '忘记密码？',
            'Email Address': '邮箱地址', 'Confirm Password': '确认密码', 'New Password': '新密码',
            'Current Password': '当前密码', 'Update Password': '更新密码', 'Username or email': '用户名或邮箱',
            'Explain your appeal': '说明申诉原因', 'Video Title': '视频标题', 'Choose image': '选择图片',
            'Edit Profile': '编辑资料', 'Profile': '个人资料', 'Display Name': '显示名称', 'Handle / User ID': '用户名 / ID',
            'No posts yet.': '暂无帖子。', 'No results found': '未找到结果', 'Loading...': '加载中...',
            'Post options': '帖子选项', 'Like post': '点赞帖子', 'Comment on post': '评论帖子', 'Share post': '分享帖子',
            'Add a comment...': '添加评论...', 'Write a comment...': '写下评论...', 'GIF': 'GIF', 'New message': '新消息'
        }
    };
    const originalText = new WeakMap();
    const originalAttributes = new WeakMap();

    function getLanguage() {
        return localStorage.getItem(STORAGE_KEY) === 'zh' ? 'zh' : 'en';
    }

    function translateValue(value) {
        const language = getLanguage();
        return language === 'zh' ? translations.zh[value] || value : value;
    }

    function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (!originalText.has(node)) originalText.set(node, node.nodeValue);
            const raw = originalText.get(node);
            const trimmed = raw.trim();
            if (trimmed && translations.zh[trimmed]) node.nodeValue = raw.replace(trimmed, translateValue(trimmed));
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE'].includes(node.tagName)) return;
        ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
            const value = node.getAttribute(attribute);
            if (value && !originalAttributes.has(node)) originalAttributes.set(node, {});
            if (value && !originalAttributes.get(node)[attribute]) originalAttributes.get(node)[attribute] = value;
            const original = originalAttributes.get(node)?.[attribute];
            if (original) node.setAttribute(attribute, translateValue(original));
        });
        node.childNodes.forEach(translateNode);
    }

    function applyLanguage(language = getLanguage()) {
        localStorage.setItem(STORAGE_KEY, language === 'zh' ? 'zh' : 'en');
        document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
        const translatedTitles = {
            'Aero - Settings': 'Aero - 设置',
            'Aero - Liquid Social Platform': 'Aero - 社交平台',
            'Aero Admin Dashboard': 'Aero - 管理后台',
            'Aero - Verify OTP': 'Aero - 验证邮箱',
            'Account Suspended': '账户已暂停'
        };
        document.title = language === 'zh' ? (translatedTitles[originalTitle] || originalTitle) : originalTitle;
        document.body?.childNodes.forEach(translateNode);
        document.querySelectorAll('[data-language-select]').forEach((select) => { select.value = language; });
        window.dispatchEvent(new CustomEvent('aero:language-change', { detail: { language } }));
    }

    function setup() {
        applyLanguage();
        document.querySelectorAll('[data-language-select]').forEach((select) => select.addEventListener('change', (event) => applyLanguage(event.target.value)));
        const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach(translateNode)));
        observer.observe(document.body, { childList: true, subtree: true });
    }

    window.AeroI18n = { getLanguage, applyLanguage, translateValue };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();
