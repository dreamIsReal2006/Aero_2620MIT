// Client language selection and translation registry
// From: browser storage and language events -> To: localized HTML labels
(() => {
    const STORAGE_KEY = 'aero_user_lang';
    const originalTitle = document.title;
    const translations = {
        en: {
            screenTimeWeekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            cancel: 'Cancel', remove: 'Remove', remove_member_title: 'Remove member?', remove_member_confirm: 'Remove {username} from this group?', new_thread: 'New Post', post: 'Post', reply_anyone: 'Anyone can reply', add_to_thread: 'Add to thread',
            drafts: 'Drafts', topic_profile: 'Your profile', topic_technology: 'Technology', topic_design: 'Design', topic_community: 'Community',
            write_something: 'Write something...', remove_thread: 'Remove thread post', remove_attachment: 'Remove attachment', image_or_video: 'Image or video', gif_animation: 'GIF', emoji: 'Emoji', voice_input: 'Voice input', poll: 'Poll', poll_option_placeholder: 'Option {number}', poll_remove_option: 'Remove option {number}', poll_add_option: 'Add another option', poll_duration: 'Poll duration', poll_1_hour: '1 hour', poll_6_hours: '6 hours', poll_12_hours: '12 hours', poll_24_hours: '24 hours', poll_3_days: '3 days', poll_7_days: '7 days', poll_remove: 'Remove poll', poll_thread_single: 'Polls can only be added to a single post.', poll_option_required: 'Enter text for every poll option.', poll_option_duplicate: 'Poll options must be different.', quote: 'Quote', location: 'Location', audio: 'Audio',
            post_options: 'Post options', who_can_reply: 'Who can reply and quote', reply_followers: 'Your followers', reply_following: 'Profiles you follow', reply_mentioned: 'Profiles you mention',
            scheduled_post: 'Schedule', no_drafts: 'No drafts yet', unnamed_draft: 'Untitled draft', selected_gif: 'Selected GIF', remove_gif: 'Remove GIF', choose_topic: 'Choose community or topic', post_attachments: 'Post attachments and tools', select_gif: 'Select GIF',
            unsupported_voice: 'Voice input is not supported in this browser.', unsupported_audio: 'Audio attachments are not available yet.', unable_upload: 'Unable to upload media', unable_publish: 'Unable to publish post', device_location: 'This device cannot provide a location.', location_failed: 'Unable to get your location.',
            'hashtag.trending_tags': 'Trending Tags', 'hashtag.searching_tags': 'Searching tags...', 'hashtag.no_tags_found': 'No tags found',
            loading_comments: 'Loading comments...', 'no_comments': 'No comments yet.',
            no_shorts: 'No Shorts available yet.', 'upload_first_video': '+ Upload First Video', 'upload_video_btn': '+ Video',
            deleteVideoTitle: 'Delete Video?', deleteVideoConfirm: 'This action cannot be undone.',
            shared_post_from: 'Shared a post from {user}', 'delete_post': 'Delete Post', 'report_post_title': 'Report post',
            report_reason_prompt: 'Tell us what is wrong...', 'submit_report': 'Submit report', 'role_admin': 'Admin', 'role_moderator': 'Moderator',
            admin_back_to_aero: '← Back to Aero', admin_dashboard_title: 'Admin Dashboard', admin_total_users: 'TOTAL USERS', admin_total_posts: 'TOTAL POSTS', admin_pending_reports: 'PENDING REPORTS', admin_account_access: 'ACCOUNT ACCESS', admin_users: 'Users', admin_search_placeholder: 'Search by username or email', admin_support_queue: 'SUPPORT QUEUE', admin_appeals: 'Appeals',
            search_users_title: 'USERS', 'search_posts_title': 'POSTS / TOPICS', 'no_posts_found': 'No posts found',
            press_enter_search: 'Press Enter or Click to see all results for "{query}"', 'visit': 'Visit',
            tab_all: 'All', 'tab_mentions': 'Mentions', 'tab_likes': 'Likes', 'followed_you': 'followed you',
            liked_your_post: 'liked your post', 'history': 'History', 'nav_history': 'History', 'no_notifications': 'No notifications', 'no_bookmarks': 'No bookmarks', 'no_history': 'No history',
            'author': 'Author', 'author_badge': 'Author',
            'post.bookmark': 'Bookmark Post', 'post.remove_bookmark': 'Remove Bookmark',
            'post.copy_link': 'Copy Link', 'post.not_interested': 'Not Interested',
            'post.follow': 'Follow', 'post.unfollow': 'Unfollow', 'post.report': 'Report Post',
            'share.nfc.instructions': 'Turn on NFC, then bring the backs of the phones close together.',
            'share.nfc.unsupported': 'This browser does not support NFC. Scan the QR code or copy the profile link.',
            'share.nfc.success': 'NFC link written. Bring the phones together to open the profile.',
            'share.nfc.copied': 'NFC could not write. The profile link was copied to the clipboard.',
            'share.nfc.write_failed': 'NFC writing failed. Scan the QR code or copy the profile link.',
            'Tap to share': 'Tap to share',
            'common.new_post': 'New Post', 'common.new_video': 'Video',
            'auth.or_continue_with': 'Or continue with', 'auth.google': 'Sign in with Google', 'auth.github': 'Sign in with GitHub',
            'chat.info.title': 'Conversation info', 'chat.info.close': 'Close conversation information',
            'chat.info.group_count': 'Group · {count} members', 'chat.info.member_count': '{count} members',
            'followers_count': 'Followers {count}', 'following_count': 'Following {count}', 'follow_back': 'Follow back', 'follow': 'Follow',
            'Followers': 'Followers', 'Following': 'Following', 'Subscribed': 'Subscribed', 'Follow back': 'Follow back', 'Follow user': 'Follow user', 'Unfollow': 'Unfollow',
            'View followers': 'View followers', 'View following': 'View following', 'Loading people...': 'Loading people...',
            'No people to show yet.': 'No people to show yet.', 'Unable to load this list.': 'Unable to load this list.',
            'Unable to update follow status.': 'Unable to update follow status.',
            'chat.date.today': 'Today', 'chat.date.yesterday': 'Yesterday',
            'chat.system.you_added_members': 'You invited {members} to the group',
            'chat.system.actor_added_members': '{actor} invited {members} to the group',
            'chat.system.you_removed_member': 'You removed {member} from the group',
            'chat.system.actor_removed_member': '{actor} removed {member} from the group',
            'chat.system.you_updated_group': 'You changed the group name to {name}',
            'chat.system.actor_updated_group': '{actor} changed the group name to {name}',
            'chat.info.edit_group': 'Edit group info', 'chat.info.edit_group_name_title': 'Edit group name',
            'chat.info.edit_group_name_prompt': 'Choose a new name for {group}.',
            'chat.info.group_name_placeholder': 'Group name', 'chat.info.save_group_name': 'Save name',
            'chat.info.enter_group_name': 'Enter a group name.', 'chat.info.unable_update_group': 'Unable to update group info.',
            'chat.info.view_members': 'View Members', 'chat.info.add_members_title': 'Add Members',
            'chat.info.search_contacts': 'Search contacts', 'chat.info.confirm_add_members': 'Confirm Add',
            'chat.info.no_available_members': 'All your contacts are already in this group.',
            'chat.info.unable_add_members': 'Unable to add members.', 'chat.info.members_added': 'Members added.',
            'chat.info.remove_member': 'Remove', 'chat.info.confirm_remove_member_title': 'Remove member?',
            'chat.info.confirm_remove_member': 'Remove @{user} from this group?',
            'chat.info.unable_remove_member': 'Unable to remove this member.', 'chat.info.member_removed': 'Member removed.',
            'chat.info.confirm_block_title': 'Block user?', 'chat.info.confirm_unblock_title': 'Unblock user?',
            'chat.info.confirm_leave_title': 'Leave group?',
            'chat.info.about_default': 'Hey there! I am using Aero.', 'chat.info.voice': 'Voice', 'chat.info.video': 'Video',
            'chat.info.add_member': 'Add member', 'chat.info.search': 'Search', 'chat.info.search_messages': 'Search messages...',
            'chat.info.search_members': 'Search members', 'chat.info.media': 'Media, links and docs',
            'chat.info.media_tab': 'Media', 'chat.info.docs_tab': 'Docs', 'chat.info.links_tab': 'Links',
            'chat.info.no_media': 'No shared media yet', 'chat.info.open_image': 'Open shared image',
            'chat.info.no_docs': 'No shared documents yet', 'chat.info.no_links': 'No shared links yet',
            'chat.info.loading_history': 'Loading conversation files...', 'chat.info.open_file': 'Open file',
            'chat.info.download_file': 'Download file',
            'chat.info.open_video': 'Open shared video', 'chat.info.starred': 'Starred messages',
            'chat.info.mute': 'Mute notifications', 'chat.info.unmute': 'Unmute notifications',
            'chat.info.block': 'Block user', 'chat.info.unblock': 'Unblock user', 'chat.info.notification_settings': 'Notification settings',
            'chat.info.leave': 'Exit group', 'chat.info.report': 'Report group', 'chat.info.clear': 'Clear chat',
            'chat.info.call_unavailable': 'Calls are not available yet',
            'chat.info.member_management_unavailable': 'Member management is not available yet',
            'chat.info.reporting_unavailable': 'Group reporting is not available yet',
            'chat.info.clear_unavailable': 'Server-side chat clearing is not available yet',
            'chat.info.loading_members': 'Loading members...', 'chat.info.members': 'Members',
            'chat.info.view_all': 'View all {count}', 'chat.info.group_admin': 'Group admin',
            'chat.info.member': 'Member', 'chat.info.unable_load_members': 'Unable to load members',
            'chat.info.unable_update_notifications': 'Unable to update notifications.',
            'chat.info.group_notifications_unavailable': 'Group notification settings are not available yet.',
            'chat.info.confirm_block': 'Block @{user}?', 'chat.info.confirm_unblock': 'Unblock @{user}?',
            'chat.info.unable_block': 'Unable to block this user.', 'chat.info.unable_unblock': 'Unable to unblock this user.',
            'chat.info.user_blocked': 'User blocked.', 'chat.info.user_unblocked': 'User unblocked.',
            'chat.info.you_blocked_user': 'You have blocked this user.', 'chat.info.user_blocked_you': 'This user has blocked you.', 'chat.info.confirm_leave': 'Leave {group}?',
            'chat.info.unable_leave': 'Unable to leave this group.', 'chat.info.select_contact': 'Select a contact', 'chat.info.no_contacts': 'No contacts yet.',
            'chat.info.no_starred': 'No starred messages in this conversation.',
            'chat.info.history_clear_unavailable': 'Chat history is stored on the server and cannot be cleared from this device.',
            'chat.info.star_message': 'Star message', 'chat.info.unstar_message': 'Unstar message',
            'chat.info.group_members': 'Group members', 'chat.info.leave_group': 'Leave Group',
            'chat.info.delete_group': 'Delete Group', 'chat.info.unable_load_group_members': 'Unable to load group members.',
            'chat.info.open': 'Open conversation info', 'chat.info.mute_user': 'Mute user',
            'chat.info.unmute_user': 'Unmute user', 'chat.info.delete_message': 'Delete message'
        },
        zh: {
            screenTimeWeekdays: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
            cancel: '取消', remove: '移除', remove_member_title: '移除成员？', remove_member_confirm: '确定要将 {username} 从此群组中移除吗？', new_thread: '新建帖子', post: '发布', reply_anyone: '任何人', add_to_thread: '添加到串文',
            drafts: '草稿箱', topic_profile: '个人主页', topic_technology: '科技', topic_design: '设计', topic_community: '社群',
            write_something: '写点什么...', remove_thread: '删除串文', remove_attachment: '移除附件', image_or_video: '图片或视频', gif_animation: 'GIF 动画', emoji: '表情', voice_input: '语音输入', poll: '投票', poll_option_placeholder: '选项 {number}', poll_remove_option: '删除选项 {number}', poll_add_option: '添加另一选项', poll_duration: '投票时长', poll_1_hour: '1 小时', poll_6_hours: '6 小时', poll_12_hours: '12 小时', poll_24_hours: '24 小时', poll_3_days: '3 天', poll_7_days: '7 天', poll_remove: '移除投票', poll_thread_single: '投票仅支持单条帖子。', poll_option_required: '请填写所有投票选项。', poll_option_duplicate: '投票选项不能重复。', quote: '引用', location: '位置', audio: '音频',
            post_options: '帖子选项', who_can_reply: '谁能回复和引用', reply_followers: '你的粉丝', reply_following: '你关注的主页', reply_mentioned: '你提及的主页',
            scheduled_post: '定时发布', no_drafts: '还没有草稿', unnamed_draft: '未命名草稿', selected_gif: '所选 GIF', remove_gif: '移除 GIF', choose_topic: '选择社群或话题', post_attachments: '帖子附件和工具', select_gif: '选择 GIF',
            unsupported_voice: '此浏览器暂不支持语音输入。', unsupported_audio: '音频附件暂不可用。', unable_upload: '无法上传媒体', unable_publish: '无法发布帖子', device_location: '此设备无法获取位置。', location_failed: '无法获取位置。',
            'hashtag.trending_tags': '热门标签', 'hashtag.searching_tags': '正在寻找标签...', 'hashtag.no_tags_found': '未找到相关标签',
            loading_comments: '加载评论中...', 'no_comments': '暂无评论',
            no_shorts: '暂无短视频', 'upload_first_video': '+ 上传第一个视频', 'upload_video_btn': '+ 视频',
            deleteVideoTitle: '确定删除该视频？', deleteVideoConfirm: '此操作无法撤销。',
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
            'Send': '发送', 'Comments': '评论', 'Subscribed': '已订阅', 'No contacts yet.': '暂无联系人。', 'No notifications yet.': '暂无通知。',
            'Search by username or email': '按用户名或邮箱搜索', admin_back_to_aero: '← 返回 Aero', admin_dashboard_title: '管理员控制台', admin_total_users: '总用户数', admin_total_posts: '总动态数', admin_pending_reports: '待处理举报', admin_account_access: '账户权限管理', admin_users: '用户列表', admin_search_placeholder: '按用户名或邮箱搜索', admin_support_queue: '工单与申诉队列', admin_appeals: '申诉处理', 'Hello !': '你好！', 'Welcome': '欢迎',
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
            'share.nfc.instructions': '请开启 NFC，并将两台手机背部靠近。',
            'share.nfc.unsupported': '当前浏览器不支持 NFC，请扫描二维码或复制个人主页链接。',
            'share.nfc.success': 'NFC 链接已写入，请将两台手机靠近以打开个人主页。',
            'share.nfc.copied': 'NFC 写入失败，个人主页链接已复制到剪贴板。',
            'share.nfc.write_failed': 'NFC 写入失败，请扫描二维码或复制个人主页链接。',
            'Tap to share': '轻触开始分享',
            'common.new_post': '发布新帖', 'common.new_video': '视频',
            'auth.or_continue_with': '或使用以下方式继续', 'auth.google': '使用 Google 登录', 'auth.github': '使用 GitHub 登录',
            'chat.info.title': '会话信息', 'chat.info.close': '关闭会话信息',
            'chat.info.group_count': '群组 · {count} 位成员', 'chat.info.member_count': '{count} 位成员',
            'followers_count': '粉丝 {count}', 'following_count': '关注 {count}', 'follow_back': '回关', 'follow': '关注',
            'Followers': '粉丝', 'Following': '已关注', 'Follow back': '回关', 'Follow user': '关注用户', 'Unfollow': '取消关注',
            'View followers': '查看粉丝', 'View following': '查看已关注', 'Loading people...': '正在加载用户…',
            'No people to show yet.': '暂无用户。', 'Unable to load this list.': '无法加载此列表。',
            'Unable to update follow status.': '无法更新关注状态。',
            'chat.date.today': '今天', 'chat.date.yesterday': '昨天',
            'chat.system.you_added_members': '你邀请了 {members} 加入群组',
            'chat.system.actor_added_members': '{actor} 邀请 {members} 加入群组',
            'chat.system.you_removed_member': '你将 {member} 移出了群组',
            'chat.system.actor_removed_member': '{actor} 将 {member} 移出了群组',
            'chat.system.you_updated_group': '你将群组名称修改为 {name}',
            'chat.system.actor_updated_group': '{actor} 将群组名称修改为 {name}',
            'chat.info.edit_group': '编辑群组信息', 'chat.info.edit_group_name_title': '修改群组名称',
            'chat.info.edit_group_name_prompt': '为“{group}”设置新名称。',
            'chat.info.group_name_placeholder': '群组名称', 'chat.info.save_group_name': '保存名称',
            'chat.info.enter_group_name': '请输入群组名称。', 'chat.info.unable_update_group': '无法更新群组信息。',
            'chat.info.view_members': '查看成员', 'chat.info.add_members_title': '添加成员',
            'chat.info.search_contacts': '搜索联系人', 'chat.info.confirm_add_members': '确认添加',
            'chat.info.no_available_members': '所有联系人都已在此群组中。',
            'chat.info.unable_add_members': '无法添加成员。', 'chat.info.members_added': '成员已添加。',
            'chat.info.remove_member': '移除', 'chat.info.confirm_remove_member_title': '移除成员？',
            'chat.info.confirm_remove_member': '确定要将 @{user} 移出群组吗？',
            'chat.info.unable_remove_member': '无法移除该成员。', 'chat.info.member_removed': '成员已移除。',
            'chat.info.confirm_block_title': '拉黑用户？', 'chat.info.confirm_unblock_title': '取消拉黑？',
            'chat.info.confirm_leave_title': '退出群组？',
            'chat.info.about_default': '嗨，我正在使用 Aero。', 'chat.info.voice': '语音', 'chat.info.video': '视频',
            'chat.info.add_member': '添加成员', 'chat.info.search': '搜索', 'chat.info.search_messages': '搜索消息...',
            'chat.info.search_members': '搜索成员', 'chat.info.media': '媒体、链接和文件',
            'chat.info.media_tab': '媒体', 'chat.info.docs_tab': '文件', 'chat.info.links_tab': '链接',
            'chat.info.no_media': '暂无共享媒体', 'chat.info.open_image': '打开共享图片',
            'chat.info.no_docs': '暂无共享文件', 'chat.info.no_links': '暂无共享链接',
            'chat.info.loading_history': '正在加载会话文件...', 'chat.info.open_file': '打开文件',
            'chat.info.download_file': '下载文件',
            'chat.info.open_video': '打开共享视频', 'chat.info.starred': '已加星标的消息',
            'chat.info.mute': '静音通知', 'chat.info.unmute': '取消静音通知',
            'chat.info.block': '拉黑用户', 'chat.info.unblock': '取消拉黑', 'chat.info.notification_settings': '通知设置',
            'chat.info.leave': '退出群组', 'chat.info.report': '举报群组', 'chat.info.clear': '清空聊天',
            'chat.info.call_unavailable': '通话功能暂不可用',
            'chat.info.member_management_unavailable': '成员管理功能暂不可用',
            'chat.info.reporting_unavailable': '群组举报功能暂不可用',
            'chat.info.clear_unavailable': '暂不支持从服务器清空聊天记录',
            'chat.info.loading_members': '正在加载成员...', 'chat.info.members': '群组成员',
            'chat.info.view_all': '查看全部 {count} 位成员', 'chat.info.group_admin': '群管理员',
            'chat.info.member': '成员', 'chat.info.unable_load_members': '无法加载成员',
            'chat.info.unable_update_notifications': '无法更新通知设置。',
            'chat.info.group_notifications_unavailable': '群组通知设置暂不可用。',
            'chat.info.confirm_block': '确定拉黑 @{user} 吗？', 'chat.info.confirm_unblock': '确定取消拉黑 @{user} 吗？',
            'chat.info.unable_block': '无法拉黑该用户。', 'chat.info.unable_unblock': '无法取消拉黑该用户。',
            'chat.info.user_blocked': '已拉黑该用户。', 'chat.info.user_unblocked': '已取消拉黑该用户。',
            'chat.info.you_blocked_user': '您已拉黑此用户，无法发送消息。', 'chat.info.user_blocked_you': '此用户已拉黑您，无法发送消息。', 'chat.info.confirm_leave': '确定退出 {group} 吗？',
            'chat.info.unable_leave': '无法退出该群组。', 'chat.info.select_contact': '选择联系人', 'chat.info.no_contacts': '暂无联系人。',
            'chat.info.no_starred': '此会话中没有星标消息。',
            'chat.info.history_clear_unavailable': '聊天记录保存在服务器，目前无法从此设备清空。',
            'chat.info.star_message': '为消息加星标', 'chat.info.unstar_message': '取消消息星标',
            'chat.info.group_members': '群组成员', 'chat.info.leave_group': '退出群组',
            'chat.info.delete_group': '删除群组', 'chat.info.unable_load_group_members': '无法加载群组成员。',
            'chat.info.open': '打开会话信息', 'chat.info.mute_user': '静音用户',
            'chat.info.unmute_user': '取消静音用户', 'chat.info.delete_message': '删除消息',
            'Back to contacts': '返回联系人', 'Delete message': '删除消息',
            'Create group': '创建群组', 'Add attachment': '添加附件', 'Add emoji': '添加表情',
            'Add GIF': '添加 GIF', 'Send message': '发送消息', 'Close media preview': '关闭媒体预览',
            'New Group': '新建群组', 'Group name': '群组名称', 'Create': '创建', 'Close': '关闭',
            'Message': '消息', 'Shorts': '短视频', 'Create a new post': '发布新帖',
            'Open navigation': '打开导航', 'Go to Aero home': '返回 Aero 主页', 'Open profile': '打开个人主页'
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

    function formatChatDateDivider(timestamp) {
        if (!timestamp) return '';
        const rawTimestamp = String(timestamp).trim();
        const normalizedTimestamp = /[zZ]|[+-]\d{2}:?\d{2}$/.test(rawTimestamp)
            ? rawTimestamp
            : `${rawTimestamp}Z`;
        const date = new Date(normalizedTimestamp);
        if (Number.isNaN(date.getTime())) return '';
        const dateKey = (value) => `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (dateKey(date) === dateKey(today)) return translate('chat.date.today');
        if (dateKey(date) === dateKey(yesterday)) return translate('chat.date.yesterday');
        return new Intl.DateTimeFormat(getLanguage() === 'zh' ? 'zh-CN' : 'en-US', {
            year: 'numeric',
            month: getLanguage() === 'zh' ? 'long' : 'short',
            day: 'numeric'
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
            const explicitKey = node.getAttribute(`data-i18n-${attribute}`);
            if (explicitKey) {
                node.setAttribute(attribute, translate(explicitKey));
                return;
            }
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

    window.AeroI18n = { getLanguage, applyLanguage, setLanguage, restoreUserLanguage, translateValue, t: translate, updatePageText: applyLanguage, formatChatTimestamp, formatChatDateDivider, getScreenTimeWeekdays };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
    else setup();
})();
