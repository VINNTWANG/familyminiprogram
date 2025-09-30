import { formatTime } from '../../utils/util';
const eventBus = getApp().eventBus;

Page({
  data: {
    posts: [],
    isLoading: true,
    isRefresherTriggered: false,
    userNickName: '\u5bb6\u4eba',
    userAvatarUrl: '/static/avatar1.png',
    isAdmin: false,
    pageSize: 10,
    lastCreateTime: null,
    loadingMore: false,
    hasMore: true,
    scrollTop: 0,
    showBackTop: false,
    releaseFabHidden: false,
    fabAnimation: null,
    banners: [], // Remove hardcoded data, will be fetched from DB
    fabPressed: false,
    i18n: {
      publish: "\u53d1\u5e03",
      family: "\u5bb6\u5ead\u7a7a\u95f4",
      remind: "\u63d0\u9192",
      welcomeBack: "\u6b22\u8fce\u56de\u6765",
      morning: "\u65e9\u4e0a\u597d",
      noon: "\u4e2d\u5348\u597d",
      afternoon: "\u4e0b\u5348\u597d",
      evening: "\u665a\u4e0a\u597d"
    },
    greetingText: "\u6b22\u8fce\u56de\u6765",
    greetingSubList: [
      "\u5bb6\u4eba\u5e38\u8054\u7cfb\uff0c\u6e29\u6696\u5e38\u5728",
      "\u8bb0\u5f55\u751f\u6d3b\u70b9\u6ef4\uff0c\u5206\u4eab\u559c\u6012\u54c0\u4e50",
      "\u5bb6\uff0c\u662f\u6211\u4eec\u6c38\u6052\u7684\u6e2f\u6e7e",
      "\u6709\u5bb6\u4eba\u7684\u5730\u65b9\uff0c\u5c31\u662f\u5fc3\u7684\u65b9\u5411",
      "\u5206\u4eab\uff0c\u8ba9\u5bb6\u7684\u6e29\u6696\u52a0\u500d"
    ],
    activeGreetingSub: '',
    loadError: false,
  },

  onLoad(option) {
    if (option && option.oper === 'release') {
      wx.showToast({ title: '\u53d1\u5e03\u6210\u529f', icon: 'success' });
    }
    this.loadPosts(true);
    this.fetchBanners();
    this.setGreeting();
  },

  // Fetch banners
  async fetchBanners() {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('banners').orderBy('createTime', 'desc').limit(10).get();
      const bannerDocs = res.data || [];
      if (bannerDocs.length > 0) {
        const fileList = bannerDocs.map(item => item.fileId).filter(Boolean);
        const tempUrlRes = await wx.cloud.getTempFileURL({ fileList });
        const urls = (tempUrlRes.fileList || []).map(item => item.tempFileURL).filter(Boolean);
        this.setData({ banners: urls });
      } else {
        this.setData({ banners: ['/static/home/swiper0.png', '/static/home/card2.png', '/static/home/card4.png'] });
      }
    } catch (e) {
      console.error('Failed to fetch banners', e);
      this.setData({ banners: ['/static/home/swiper0.png', '/static/home/card2.png', '/static/home/card4.png'] });
    }
  },
  onUnload() {
    // Clean up Event Bus Listeners
    eventBus.off('post-updated', this.handlePostUpdate);
    eventBus.off('post-deleted', this.handlePostDelete);
    eventBus.off('request-logout', this.handleLogout);
  },

  onShow() {
    this.updateUserAvatar();
    this.setRandomGreetingSub();
    this.lastScrollY = 0;
    this.setData({ releaseFabHidden: false });
    this._initFabAnimation();
  },

  _initFabAnimation() {
    try {
      this.fabAnim = wx.createAnimation({ duration: 220, timingFunction: 'ease' });
      this.fabAnim.opacity(1).translateY(0).step();
      this.setData({ fabAnimation: this.fabAnim.export() });
    } catch (e) { /* ignore in non-UI env */ }
  },

  _hideFab() {
    if (!this.fabAnim) return;
    this.fabAnim.opacity(0).translateY(100).step();
    this.setData({ fabAnimation: this.fabAnim.export() });
  },

  _showFab() {
    if (!this.fabAnim) return;
    this.fabAnim.opacity(1).translateY(0).step();
    this.setData({ fabAnimation: this.fabAnim.export() });
  },

  async updateUserAvatar() {
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      this.setData({
        userNickName: '\u5bb6\u4eba',
        userAvatarUrl: '/static/avatar1.png',
        isAdmin: false,
      });
      return;
    }

    let finalAvatarUrl = userInfo.avatarUrl || '/static/avatar1.png';
    if (userInfo.avatarUrl && userInfo.avatarUrl.startsWith('cloud://')) {
      try {
        const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: [userInfo.avatarUrl] });
        if (tempUrlRes.fileList && tempUrlRes.fileList[0] && tempUrlRes.fileList[0].status === 0) {
          finalAvatarUrl = tempUrlRes.fileList[0].tempFileURL;
        }
      } catch (e) {
        console.error('[getTempFileURL] Failed to get avatar URL', e);
      }
    }

    this.setData({
      userNickName: userInfo.nickName || '家人',
      userAvatarUrl: finalAvatarUrl,
      isAdmin: userInfo.isAdmin || false,
    });
  },

  onRefresherRefresh() { 
    this.loadPosts(true); 
    this.fetchBanners(); // Also refresh banners
  },

  async loadPosts(reset = false) {
    if (reset) {
      this.setData({ isLoading: true, isRefresherTriggered: true, lastCreateTime: null, hasMore: true, posts: [], loadError: false });
    } else {
      if (!this.data.hasMore || this.data.loadingMore) return;
      this.setData({ loadingMore: true });
    }

    try {
      const postRes = await wx.cloud.callFunction({
        name: 'getPosts',
        data: { pageSize: this.data.pageSize, lastCreateTime: this.data.lastCreateTime }
      });
      let postsData = postRes.result || [];

      if (postsData.length === 0) {
        if (reset) this.setData({ posts: [] });
        this.setData({ hasMore: false, isLoading: false, isRefresherTriggered: false, loadingMore: false });
        return;
      }

      const authorIds = [...new Set(postsData.map(p => p._openid))];
      const usersRes = await wx.cloud.callFunction({ name: 'getUsers', data: { userIds: authorIds } });
      const usersData = usersRes.result || [];
      const usersMap = usersData.reduce((acc, user) => { acc[user._openid] = user; return acc; }, {});

      const allFileIDs = [];
      postsData.forEach(post => {
        if (Array.isArray(post.images)) allFileIDs.push(...post.images);
        if (Array.isArray(post.videos)) allFileIDs.push(...post.videos);
        if (Array.isArray(post.audios)) allFileIDs.push(...post.audios);
        if (Array.isArray(post.videoCovers)) allFileIDs.push(...post.videoCovers);
        const user = usersMap[post._openid];
        if (user && user.avatarUrl) { allFileIDs.push(user.avatarUrl); }
      });

      const uniqueFileIDs = [...new Set(allFileIDs)].filter(id => id && id.startsWith('cloud://'));

      let urlMap = {};
      if (uniqueFileIDs.length > 0) {
        const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: uniqueFileIDs });
        urlMap = tempUrlRes.fileList.reduce((map, item) => { if (item.status === 0) map[item.fileID] = item.tempFileURL; return map; }, {});
      }

      const enrichedPosts = postsData.map(post => {
        const author = usersMap[post._openid];
        const finalAuthorInfo = { ...(post.authorInfo || {}), ...author };
        if (finalAuthorInfo.avatarUrl && urlMap[finalAuthorInfo.avatarUrl]) {
          finalAuthorInfo.avatarUrl = urlMap[finalAuthorInfo.avatarUrl];
        }

        const resolvedImages = (post.images || []).map(id => urlMap[id] || id);
        const resolvedVideos = (post.videos || []).map(id => urlMap[id] || id);
        const resolvedVideoCovers = (post.videoCovers || []).map(id => urlMap[id] || id);
        const rawAudios = Array.isArray(post.audios) ? post.audios : [];
        const resolvedAudios = rawAudios.map(a => {
          if (typeof a === 'string') { return { url: urlMap[a] || a }; }
          return { ...a, url: urlMap[a.url] || a.url };
        });

        const totalCount = resolvedImages.length + resolvedVideos.length + resolvedAudios.length;
        let mediaGrid = [];
        let displayAudio = null;
        if (totalCount > 4) {
          const mediaCombined = [];
          for (let i = 0; i < resolvedVideos.length; i++) {
            mediaCombined.push({ type: 'video', src: resolvedVideoCovers[i] || resolvedImages[0] || '', videoSrc: resolvedVideos[i] });
          }
          resolvedImages.forEach(imgSrc => mediaCombined.push({ type: 'image', src: imgSrc }));
          resolvedAudios.forEach(a => mediaCombined.push({ type: 'audio', src: '', audio: a }));
          mediaGrid = mediaCombined.slice(0, 4);
        } else {
          if (resolvedVideos.length > 0) {
            mediaGrid.push({ type: 'video', src: resolvedVideoCovers[0] || resolvedImages[0], videoSrc: resolvedVideos[0] });
          }
          resolvedImages.forEach(imgSrc => mediaGrid.push({ type: 'image', src: imgSrc }));
          if (resolvedAudios.length > 0) {
            const audio = resolvedAudios[0];
            displayAudio = { ...audio, playing: false, durationStr: audio.duration ? `${Math.round(audio.duration)}s` : '' };
          }
          mediaGrid = mediaGrid.slice(0, 4);
        }
        const mediaMoreCount = totalCount > 4 ? (totalCount - 4) : 0;

        return { ...post, authorInfo: finalAuthorInfo, timestamp: post.createTime ? formatTime(post.createTime) : '未知时间', mediaGrid, mediaMoreCount, displayAudio, images: [], videos: [], audios: [], videoCovers: [] };
      });

      const nextPosts = reset ? enrichedPosts : [...this.data.posts, ...enrichedPosts];
      const lastCreateTime = nextPosts.length > 0 ? nextPosts[nextPosts.length - 1].createTime : null;
      const hasMore = postsData.length === this.data.pageSize;
      this.setData({ posts: nextPosts, lastCreateTime, hasMore });
    } catch (err) {
      console.error('[首页加载] 失败', err);
      if (reset) this.setData({ loadError: true });
    } finally {
      this.setData({ isLoading: false, isRefresherTriggered: false, loadingMore: false });
    }
  },

  // (The rest of the functions remain the same)
  handlePostUpdate(data) { if (!data || !data.postId) return; const posts = this.data.posts.map(p => { if (p._id === data.postId) { return { ...p, reactions: data.reactions }; } return p; }); this.setData({ posts }); },
  handlePostDelete(data) { if (!data || !data.postId) return; const newPosts = this.data.posts.filter(p => p._id !== data.postId); this.setData({ posts: newPosts }); },
  handleLogout() { wx.showModal({ title: '提示', content: '确认要退出登录吗？', success: (res) => { if (res.confirm) { wx.removeStorageSync('userInfo'); this.setData({ userNickName: '\u5bb6\u4eba', userAvatarUrl: '/static/avatar1.png', isAdmin: false, }); wx.showToast({ title: '已退出登录', icon: 'none' }); } } }); },
  openDetail(e) { const id = e && e.detail && e.detail.id; if (id) wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` }); },
  goRelease() { wx.navigateTo({ url: '/pages/release/index' }); },
  goFamily() { wx.navigateTo({ url: '/pages/family/index' }); },
  goNotifications() { wx.navigateTo({ url: '/pages/notifications/index' }); },
  onReachBottom() { this.loadPosts(false); },
  onScroll(e) { const y = (e && e.detail && e.detail.scrollTop) || 0; if (y > 300 && !this.data.showBackTop) this.setData({ showBackTop: true }); if (y <= 300 && this.data.showBackTop) this.setData({ showBackTop: false }); const last = this.lastScrollY || 0; const delta = y - last; const threshold = 8; if (delta > threshold && !this.data.releaseFabHidden) { this.setData({ releaseFabHidden: true }); this._hideFab(); } else if (delta < -threshold && this.data.releaseFabHidden) { this.setData({ releaseFabHidden: false }); this._showFab(); } this.lastScrollY = y; },
  backToTop() { this.setData({ scrollTop: 0 }); },
  onFabTouchStart() { if (!this.data.fabPressed) this.setData({ fabPressed: true }); },
  onFabTouchEnd() { if (this.data.fabPressed) this.setData({ fabPressed: false }); },
  onBannerTap(e) { const idx = Number((e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.idx) || 0); if (idx === 0) this.goRelease(); else wx.navigateTo({ url: '/pages/search/index' }); },
  setGreeting() {
    const h = new Date().getHours();
    const t = this.data.i18n;
    let text = t.welcomeBack || "\u6b22\u8fce\u56de\u6765";
    if (h >= 5 && h < 11) text = t.morning;
    else if (h >= 11 && h < 14) text = t.noon;
    else if (h >= 14 && h < 18) text = t.afternoon;
    else text = t.evening;
    this.setData({ greetingText: text });
  },
  setRandomGreetingSub() {
    const subList = this.data.greetingSubList || [];
    const randomIndex = subList.length ? Math.floor(Math.random() * subList.length) : 0;
    this.setData({ activeGreetingSub: subList.length ? subList[randomIndex] : '' });
  },
});
