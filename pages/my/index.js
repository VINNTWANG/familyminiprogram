import { formatTime } from '../../utils/util';

Page({
  data: {
    // Page state
    isLoad: false,
    isLoading: true,
    activeTab: 'posts', // 'posts' or 'profile'

    // User data
    personalInfo: {},
    userPosts: [],

    // For login prompt
    tempAvatarUrl: '',
    tempNickName: '',

    // For dynamic navbar height
    statusBarHeightRpx: 0,
    navBarContentHeightRpx: 0,
  },

  onLoad() {
    // --- 1. Calculate safe area for custom navbar ---
    const systemInfo = wx.getSystemInfoSync();
    const screenWidth = systemInfo.screenWidth;
    const statusBarHeightPx = systemInfo.statusBarHeight;
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarContentHeightPx = (menuButtonInfo.top - statusBarHeightPx) * 2 + menuButtonInfo.height;
    const rpxRatio = 750 / screenWidth;

    this.setData({
      statusBarHeightRpx: statusBarHeightPx * rpxRatio,
      navBarContentHeightRpx: navBarContentHeightPx * rpxRatio,
    });
  },

  onShow() {
    this.fetchUserProfile();
  },

  async fetchUserProfile() {
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (!cachedUserInfo || !cachedUserInfo._id) {
      this.setData({ isLoad: false, isLoading: false });
      return;
    }

    try {
      const db = wx.cloud.database();
      const res = await db.collection('users').doc(cachedUserInfo._id).get();
      let freshUserInfo = res.data;

      if (freshUserInfo && freshUserInfo.avatarUrl && freshUserInfo.avatarUrl.startsWith('cloud://')) {
        const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: [freshUserInfo.avatarUrl] });
        if (tempUrlRes.fileList && tempUrlRes.fileList[0] && tempUrlRes.fileList[0].status === 0) {
          freshUserInfo.avatarUrl = tempUrlRes.fileList[0].tempFileURL;
        }
      }

      if (freshUserInfo) {
        console.log('当前用户信息 (Current User Info):', freshUserInfo);
        wx.setStorageSync('userInfo', freshUserInfo); // Update the cache
        this.setData({ personalInfo: freshUserInfo, isLoad: true });
        this.fetchMyPosts(); // Fetch posts with fresh info
      } else {
        this.setData({ isLoad: false });
      }
    } catch (e) {
      console.error('Failed to fetch user profile', e);
      this.setData({ personalInfo: cachedUserInfo, isLoad: true });
      this.fetchMyPosts();
    }
  },

  fetchMyPosts() {
  this.setData({ isLoading: true });
  const userInfo = wx.getStorageSync('userInfo');
  if (!userInfo || !userInfo._openid) {
    this.setData({ isLoading: false, userPosts: [] });
    return;
  }

  const db = wx.cloud.database();
  db.collection('posts')
    .where({ _openid: userInfo._openid })
    .orderBy('createTime', 'desc')
    .get()
    .then(async (res) => {
      const freshPersonalInfo = this.data.personalInfo;
      const rawPosts = res.data || [];

      const fileIDs = [];
      rawPosts.forEach((p) => {
        (Array.isArray(p.images) ? p.images : []).forEach((id) => { if (typeof id === 'string' && id.startsWith('cloud://')) fileIDs.push(id); });
        (Array.isArray(p.videos) ? p.videos : []).forEach((id) => { if (typeof id === 'string' && id.startsWith('cloud://')) fileIDs.push(id); });
        (Array.isArray(p.videoCovers) ? p.videoCovers : []).forEach((id) => { if (typeof id === 'string' && id.startsWith('cloud://')) fileIDs.push(id); });
        (Array.isArray(p.audios) ? p.audios : []).forEach((a) => {
          if (typeof a === 'string' && a.startsWith('cloud://')) fileIDs.push(a);
          else if (a && typeof a.url === 'string' && a.url.startsWith('cloud://')) fileIDs.push(a.url);
        });
      });

      const unique = [...new Set(fileIDs)];
      let urlMap = {};
      if (unique.length > 0) {
        try {
          const chunkSize = 50;
          for (let i = 0; i < unique.length; i += chunkSize) {
            const chunk = unique.slice(i, i + chunkSize);
            const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: chunk });
            const chunkUrlMap = (tempUrlRes.fileList || []).reduce((acc, x) => {
              if (x.status === 0) acc[x.fileID] = x.tempFileURL;
              return acc;
            }, {});
            Object.assign(urlMap, chunkUrlMap); // Merge results from each chunk
          }
        } catch (e) {
          console.error('[my] getTempFileURL failed', e);
        }
      }

      const posts = rawPosts.map((post) => {
        const resolvedImages = (post.images || []).map((id) => urlMap[id] || id);
        const resolvedVideos = (post.videos || []).map((id) => urlMap[id] || id);
        const resolvedVideoCovers = (post.videoCovers || []).map((id) => urlMap[id] || id);
        const rawAudios = Array.isArray(post.audios) ? post.audios : [];
        const resolvedAudios = rawAudios.map((a) => (typeof a === 'string' ? { url: urlMap[a] || a } : { ...a, url: a && a.url ? (urlMap[a.url] || a.url) : '' }));

        const total = resolvedImages.length + resolvedVideos.length + resolvedAudios.length;
        let mediaGrid = [];
        let displayAudio = null;
        if (total > 4) {
          const combined = [];
          for (let i = 0; i < resolvedVideos.length; i++) combined.push({ type: 'video', src: resolvedVideoCovers[i] || resolvedImages[0] || '', videoSrc: resolvedVideos[i] });
          resolvedImages.forEach((src) => combined.push({ type: 'image', src }));
          resolvedAudios.forEach((a) => combined.push({ type: 'audio', src: '', audio: a }));
          mediaGrid = combined.slice(0, 4);
        } else {
          if (resolvedVideos.length > 0) mediaGrid.push({ type: 'video', src: resolvedVideoCovers[0] || resolvedImages[0] || '', videoSrc: resolvedVideos[0] });
          resolvedImages.forEach((src) => mediaGrid.push({ type: 'image', src }));
          if (resolvedAudios.length > 0) {
            const a = resolvedAudios[0];
            const durationStr = (a && a.duration) ? (Math.round(a.duration) + 's') : '';
            displayAudio = { ...a, playing: false, durationStr };
          }
        }
        const mediaMoreCount = total > 4 ? (total - 4) : 0;
        return { ...post, authorInfo: freshPersonalInfo, timestamp: formatTime(post.createTime), mediaGrid, mediaMoreCount, displayAudio, images: [], videos: [], audios: [], videoCovers: [] };
      });
      this.setData({ userPosts: posts, isLoading: false });
    })
    .catch((err) => {
      console.error("'我的发布'查询失败", err);
      this.setData({ isLoading: false });
    });
  },

  handleTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab && tab !== this.data.activeTab) {
      this.setData({ activeTab: tab });
    }
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确认要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('userInfo');
          this.setData({
            isLoad: false,
            personalInfo: {},
            userPosts: [],
            tempAvatarUrl: '',
            tempNickName: '',
          });
          wx.showToast({ title: '已退出登录', icon: 'none' });
        }
      }
    });
  },

  openDetailFromCard(e) {
    const id = e.detail && e.detail.id;
    if (id) {
      wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
    }
  },

  goNotifications() { wx.navigateTo({ url: '/pages/notifications/index' }); },
  goPersonalVerify() { wx.navigateTo({ url: '/pages/verify/personal/index' }); },
  goFamilyVerify() { wx.navigateTo({ url: '/pages/verify/family/index' }); },

  goToAdminPage() {
    wx.navigateTo({ url: '/pages/admin/verify/index' });
  },

  showAdminTooltip() {
    wx.showToast({
      title: '管理员',
      icon: 'none'
    });
  },

  onAvatarAreaTap() {
    wx.chooseAvatar({
      success: async (res) => {
        const { avatarUrl } = res;
        if (!avatarUrl) return;

        wx.showLoading({ title: '更新中...' });

        try {
          const uploadResult = await wx.cloud.uploadFile({
            cloudPath: `user_avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`,
            filePath: avatarUrl,
          });
          const newAvatarFileID = uploadResult.fileID;

          const updateResult = await wx.cloud.callFunction({
            name: 'login',
            data: { 
              action: 'updateProfile',
              avatarUrl: newAvatarFileID, 
            },
          });

          if (updateResult.result && updateResult.result.data) {
            const updatedUserInfo = updateResult.result.data;
            wx.setStorageSync('userInfo', updatedUserInfo);
            this.fetchUserProfile(); // Reload profile to get new temp URL
            wx.showToast({ title: '头像更新成功' });
          } else {
            throw new Error((updateResult.result && updateResult.result.message) || 'Update failed');
          }
        } catch (err) {
          wx.showToast({ title: '更新失败，请重试', icon: 'none' });
          console.error('Failed to change avatar', err);
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail || {};
    if (avatarUrl) this.setData({ tempAvatarUrl: avatarUrl });
  },

  onNicknameInput(e) {
    this.setData({ tempNickName: e.detail.value });
  },

  async onLogin() {
    if (!this.data.tempAvatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' });
      return;
    }
    if (!this.data.tempNickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `user_avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`,
        filePath: this.data.tempAvatarUrl,
      });

      const avatarFileID = uploadResult.fileID;

      const loginResult = await wx.cloud.callFunction({
        name: 'login',
        data: { 
          nickName: this.data.tempNickName,
          avatarUrl: avatarFileID, 
        },
      });

      if (loginResult.result && loginResult.result.data) {
        wx.setStorageSync('userInfo', loginResult.result.data);
        this.setData({ isLoad: true, personalInfo: loginResult.result.data });
        this.fetchMyPosts();
        wx.showToast({ title: '登录成功' });
      } else {
        throw new Error((loginResult.result && loginResult.result.message) || 'Login failed');
      }
    } catch (e) {
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      console.error(e);
    } finally {
      wx.hideLoading();
    }
  },
})