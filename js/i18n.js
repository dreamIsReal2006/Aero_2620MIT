(() => {
    const STORAGE_KEY = 'aero_user_lang';
    const originalTitle = document.title;
    const translations = {
        en: {
            screenTimeWeekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            cancel: 'Cancel', new_thread: 'New Thread', post: 'Post', reply_anyone: 'Anyone can reply', add_to_thread: 'Add to thread',
            drafts: 'Drafts', more_options: 'More options', topic_profile: 'Your profile', topic_technology: 'Technology', topic_design: 'Design', topic_community: 'Community',
            write_something: 'Write something...', remove_thread: 'Remove thread post', remove_attachment: 'Remove attachment', image_or_video: 'Image or video', gif_animation: 'GIF', emoji: 'Emoji', voice_input: 'Voice input', poll: 'Poll', quote: 'Quote', location: 'Location', audio: 'Audio',
            post_options: 'Post options', who_can_reply: 'Who can reply and quote', reply_followers: 'Your followers', reply_following: 'Profiles you follow', reply_mentioned: 'Profiles you mention', review_replies: 'Review and approve replies', share_to: 'Also share to...', dont_share: 'Don’t share',
            select_publish_time: 'Schedule post...', complete: 'Done', recommended_tags: 'Add suggested tag', scheduled_post: 'Schedule', no_drafts: 'No drafts yet', unnamed_draft: 'Untitled draft', selected_gif: 'Selected GIF', remove_gif: 'Remove GIF', choose_topic: 'Choose community or topic', post_attachments: 'Post attachments and tools', select_gif: 'Select GIF',
            unsupported_voice: 'Voice input is not supported in this browser.', unsupported_audio: 'Audio attachments are not available yet.', unable_upload: 'Unable to upload media', unable_publish: 'Unable to publish post', device_location: 'This device cannot provide a location.', location_failed: 'Unable to get your location.',
            loading_comments: 'Loading comments...', 'no_comments': 'No comments yet.',
            no_shorts: 'No Shorts available yet.', 'upload_first_video': '+ Upload First Video', 'upload_video_btn': '+ Video',
            shared_post_from: 'Shared a post from {user}', 'delete_post': 'Delete Post', 'report_post_title': 'Report post',
            report_reason_prompt: 'Tell us what is wrong...', 'submit_report': 'Submit report', 'role_admin': 'Admin', 'role_moderator': 'Moderator',
            search_users_title: 'USERS', 'search_posts_title': 'POSTS / TOPICS', 'no_posts_found': 'No posts found',
            press_enter_search: 'Press Enter or Click to see all results for "{query}"', 'visit': 'Visit',
            tab_all: 'All', 'tab_mentions': 'Mentions', 'tab_likes': 'Likes', 'followed_you': 'followed you',
            liked_your_post: 'liked your post', 'history': 'History', 'nav_history': 'History', 'no_notifications': 'No notifications', 'no_bookmarks': 'No bookmarks', 'no_history': 'No history',
            'author': 'Author', 'author_badge': 'Author',
            'post.bookmark': 'Bookmark Post', 'post.remove_bookmark': 'Remove Bookmark',
            'post.copy_link': 'Copy Link', 'post.not_interested': 'Not Interested',
            'post.follow': 'Follow', 'post.unfollow': 'Unfollow', 'post.report': 'Report Post',
            'common.new_post': 'New Post', 'common.new_video': 'Video',
            'auth.or_continue_with': 'Or continue with', 'auth.google': 'Sign in with Google', 'auth.github': 'Sign in with GitHub'
        },
        zh: {
            screenTimeWeekdays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
            cancel: '取消', new_thread: '新建帖子', post: '发布', reply_anyone: '任何人', add_to_thread: '添加到串文',
            drafts: '草稿箱', more_options: '更多选项', topic_profile: '个人主页', topic_technology: '科技', topic_design: '设计', topic_community: '社群',
            write_something: '写点什么...', remove_thread: '删除串文', remove_attachment: '移除附件', image_or_video: '图片或视频', gif_animation: 'GIF 动画', emoji: '表情', voice_input: '语音输入', poll: '投票', quote: '引用', location: '位置', audio: '音频',
            post_options: '帖子选项', who_can_reply: '谁能回复和引用', reply_followers: '你的粉丝', reply_following: '你关注的主页', reply_mentioned: '你提及的主页', review_replies: '审核并批准回复', share_to: '同时分享到...', dont_share: '不分享',
            select_publish_time: '预设发布时间...', complete: '完成', recommended_tags: '添加推荐标签', scheduled_post: '定时发布', no_drafts: '还没有草稿', unnamed_draft: '未命名草稿', selected_gif: '所选 GIF', remove_gif: '移除 GIF', choose_topic: '选择社群或话题', post_attachments: '帖子附件和工具', select_gif: '选择 GIF',
            unsupported_voice: '此浏览器暂不支持语音输入。', unsupported_audio: '音频附件暂不可用。', unable_upload: '无法上传媒体', unable_publish: '无法发布帖子', device_location: '此设备无法获取位置。', location_failed: '无法获取位置。',
            loading_comments: '加载评论中...', 'no_comments': '暂无评论',
            no_shorts: '暂无短视频', 'upload_first_video': '+ 上传第一个视频', 'upload_video_btn': '+ 视频',
            shared_post_from: '来自 {user} 的分享帖子', 'delete_post': '删除帖子', 'report_post_title': '举报帖子',
            report_reason_prompt: '请说明举报原因...', 'submit_report': '提交举报', 'role_admin': '管理员', 'role_moderator': '版主',
            search_users_title: '用户', 'search_posts_title': '帖子 / 话题', 'no_posts_found': '未找到相关帖子',
            press_enter_search: '按 Enter 或点击查看 "{query}" 的全部结果', 'visit': '访问',
            tab_all: '全部', 'tab_mentions': '提及', 'tab_likes': '赞', 'followed_you': '关注了你',
            liked_your_post: '赞了你的帖子', 'history': '历史', 'nav_history': '历史', 'no_notifications': '暂无通知', 'no_bookmarks': '暂无书签', 'no_history': '暂无浏览历史',
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
            'Add a comment...': '添加评论...', 'Write a comment...': '写下评论...', 'GIF': 'GIF', 'New message': '新消息',
            'author': '作者', 'author_badge': '作者',
            'post.bookmark': '收藏帖子', 'post.remove_bookmark': '取消收藏',
            'post.copy_link': '复制链接', 'post.not_interested': '不感兴趣',
            'post.follow': '关注', 'post.unfollow': '取消关注', 'post.report': '举报帖子',
            'common.new_post': '发布新帖', 'common.new_video': '视频',
            'auth.or_continue_with': '或使用以下方式继续', 'auth.google': '使用 Google 登录', 'auth.github': '使用 GitHub 登录'
        }
    };
    const originalText = new WeakMap();
    const originalAttributes = new WeakMap();

    function normalizeLanguage(language) {
        return language === 'zh' ? 'zh' : language === 'en' ? 'en' : null;
    }

    function getLanguage() {
        const preferred = normalizeLanguage(localStorage.getItem(STORAGE_KEY));
        if (preferred) return preferred;

        const detected = String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
        return detected;
    }

    function getScreenTimeWeekdays() {
        return [...translations[getLanguage()].screenTimeWeekdays];
    }

    function translateValue(value) {
        const language = getLanguage();
        return translations[language][value] || value;
    }

    function translate(key, values = {}) {
        const template = translations[getLanguage()][key] || key;
        return String(template).replace(/\{(\w+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match);
    }

    function formatChatTimestamp(timestamp) {
        if (!timestamp) return '';
        const rawTimestamp = String(timestamp).trim();
        const normalizedTimestamp = /[zZ]|[+-]\d{2}:?\d{2}$/.test(rawTimestamp)
            ? rawTimestamp
            : `${rawTimestamp}Z`;
        const date = new Date(normalizedTimestamp);
        if (Number.isNaN(date.getTime())) return '';
        const language = getLanguage();
        if (language === 'zh') {
            const parts = new Intl.DateTimeFormat('zh-CN', {
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).formatToParts(date).reduce((values, part) => {
                values[part.type] = part.value;
                return values;
            }, {});
            return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}`;
        }
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        }).format(date);
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
        const translationKey = node.getAttribute('data-i18n');
        if (translationKey) {
            const labelNode = node.querySelector('[data-i18n-text]') || (node.querySelector('svg') && node.querySelector('span'));
            if (labelNode) labelNode.textContent = translateValue(translationKey);
            else node.textContent = translateValue(translationKey);
        }
        ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
            const value = node.getAttribute(attribute);
            if (value && !originalAttributes.has(node)) originalAttributes.set(node, {});
            if (value && !originalAttributes.get(node)[attribute]) originalAttributes.get(node)[attribute] = value;
            const original = originalAttributes.get(node)?.[attribute];
            if (original) node.setAttribute(attribute, translateValue(original));
        });
        node.childNodes.forEach(translateNode);
    }

    function applyLanguage(language, options = {}) {
        const hasExplicitLanguage = language !== undefined;
        const normalizedLanguage = normalizeLanguage(language) || getLanguage();
        if (hasExplicitLanguage && options.persist !== false) localStorage.setItem(STORAGE_KEY, normalizedLanguage);
        localStorage.setItem('aero_language', normalizedLanguage);
        document.documentElement.lang = normalizedLanguage === 'zh' ? 'zh-CN' : 'en';
        const translatedTitles = {
            'Aero - Settings': 'Aero - 设置',
            'Aero - Liquid Social Platform': 'Aero - 社交平台',
            'Aero Admin Dashboard': 'Aero - 管理后台',
            'Aero - Verify OTP': 'Aero - 验证邮箱',
            'Account Suspended': '账户已暂停'
        };
        document.title = normalizedLanguage === 'zh' ? (translatedTitles[originalTitle] || originalTitle) : originalTitle;
        document.body?.childNodes.forEach(translateNode);
        document.querySelectorAll('[data-language-select]').forEach((select) => { select.value = normalizedLanguage; });
        window.dispatchEvent(new CustomEvent('aero:language-change', {
            detail: { language: normalizedLanguage, manual: hasExplicitLanguage }
        }));
    }

    function setLanguage(language) {
        applyLanguage(language);
    }

    function restoreUserLanguage(user) {
        const storedLanguage = normalizeLanguage(localStorage.getItem(STORAGE_KEY));
        const databaseLanguage = normalizeLanguage(user?.language_preference);
        applyLanguage(storedLanguage || databaseLanguage || getLanguage(), { persist: !storedLanguage && Boolean(databaseLanguage) });
    }

    function setup() {
        applyLanguage(undefined, { persist: false });
        document.querySelectorAll('[data-language-select]').forEach((select) => select.addEventListener('change', (event) => setLanguage(event.target.value)));
        window.addEventListener('aero:language-change', (event) => {
            if (!event.detail?.manual || !localStorage.getItem('aero_token')) return;
            window.AeroAPI?.updateProfile?.({ language_preference: event.detail.language }).catch((error) => console.error('Language preference sync failed:', error));
        });
        const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach(translateNode)));
        observer.observe(document.body, { childList: true, subtree: true });
    }

    window.AeroI18n = { getLanguage, applyLanguage, setLanguage, restoreUserLanguage, translateValue, t: translate, formatChatTimestamp, getScreenTimeWeekdays };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();
