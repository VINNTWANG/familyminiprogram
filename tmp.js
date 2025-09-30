Component({
  properties: { post: { type: Object, value: {} }, hideFooter: { type: Boolean, value: false }, isAdmin: { type: Boolean, value: false } },
  data: {
    showReactionPopup: false,
    isAudioPlaying: false,
    pressed: false,
    imageDisplay: [],
    isHot: false,
    singleImageClass: '',
    authorBadge: '',
    isImageExpanded: false,
    showBigHeart: false,
    likeCount: 0,
    displayReactions: [],
    mixMedia: false,
    // Add the missing emojiList
    emojiList: ['❤️', '👍', '👎', '😂', '😘', '😡', '😭', '😳', '🤢', '😱', '🎉', '🔥', '👏', '🙏', '🤝', '💩', '😐', '😏', '😊', '😴'],
  },
  lifetimes: {
    attached() {
      this.audioUrlCache = {};
      this.audioCtx = wx.createInnerAudioContext();
      this.audioCtx.obeyMuteSwitch = false;
      this.audioCtx.onEnded(() => this.setData({ isAudioPlaying: false }));
    },
    detached() { if (this.audioCtx) this.audioCtx.destroy(); },
  },
  observers: {
    async post(p) {
      if (!p || !p._id) return;
      let post = { ...p };

      const fileIDs = [
        ...(Array.isArray(post.images) ? post.images : []),
        ...(Array.isArray(post.videos) ? post.videos : []),
        ...(post.authorInfo && post.authorInfo.avatarUrl ? [post.authorInfo.avatarUrl] : []),
      ].filter((url) => url && typeof url === 'string' && url.startsWith('cloud://'));

      if (fileIDs.length > 0) {
        try {
          const res = await wx.cloud.getTempFileURL({ fileList: fileIDs });
          const urlMap = (res.fileList || []).reduce((acc, cur) => {
            if (cur.status === 0) acc[cur.fileID] = cur.tempFileURL;
            return acc;
          }, {});
          if (Array.isArray(post.images)) post.images = post.images.map((id) => urlMap[id] || id);
          if (Array.isArray(post.videos)) post.videos = post.videos.map((id) => urlMap[id] || id);
          if (post.authorInfo && post.authorInfo.avatarUrl && urlMap[post.authorInfo.avatarUrl]) {
            post.authorInfo.avatarUrl = urlMap[post.authorInfo.avatarUrl];
          }
        } catch (e) { console.error('post-card getTempFileURL failed', e); }
      }

      const imgs = Array.isArray(post.images) ? post.images : [];
      const vids = Array.isArray(post.videos) ? post.videos : [];
      const mixMedia = imgs.length > 0 && vids.length > 0;

      const media = [];
      imgs.forEach((u) => {
        const safe = (typeof u === 'string' && u.indexOf('cloud://') === 0) ? '/static/home/card3.png' : u;
        media.push({ type: 'image', thumb: safe, src: u, error: false });
      });
      vids.forEach((v, i) => media.push({ type: 'video', thumb: (post.videoCovers && post.videoCovers[i]) || imgs[0] || '/static/home/card3.png', src: v, error: false }));
      const maxMedia = 16;
      let extra = media.length - maxMedia;
      const mediaDisplay = media.slice(0, maxMedia);
      if (extra > 0 && mediaDisplay.length > 0) mediaDisplay[mediaDisplay.length - 1].extra = extra;

      const hotScore = (Array.isArray(post.reactions) ? post.reactions.length : 0) + (post.commentCount || 0);
      const authorBadge = (this.properties.isAdmin) ? '' : (post.authorInfo && post.authorInfo.role) || '';

      this.setData({
        mediaDisplay,
        isHot: hotScore >= 10,
        authorBadge: authorBadge,
        mixMedia,
      });
      this.computeReactions(post);

      // Process audio
      let displayAudio = null;
      if (post.audios && post.audios.length > 0) {
        const firstAudio = post.audios[0];
        displayAudio = {
          src: firstAudio.src,
          duration: firstAudio.duration,
          durationStr: this._formatDuration(firstAudio.duration),
          playing: false
        };
      }
      this.setData({ displayAudio }); // Set displayAudio directly

    },
  },
  methods: {
    _formatDuration(seconds) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      const formattedSeconds = remainingSeconds < 10 ? `0${remainingSeconds}` : `${remainingSeconds}`;
      return `${minutes}:${formattedSeconds}`;
    },
    computeReactions(p) {
      const reactions = (p && p.reactions) || [];
      if (!reactions) return this.setData({ displayReactions: [], likeCount: 0 });
      const counts = reactions.reduce((acc, cur) => (acc[cur.emoji] = (acc[cur.emoji] || 0) + 1, acc), {});
      const myOpenid = (wx.getStorageSync('userInfo') || {})._openid || null;
      const displayReactions = Object.entries(counts).map(([emoji, count]) => ({
        emoji, count, reacted: reactions.some((r) => r.openid === myOpenid && r.emoji === emoji),
      }));
      const likeCount = counts['❤️'] || 0;
      this.setData({ displayReactions, likeCount });
    },
    onLike() { this.quickLike(); },
    onComment() { const id = this.data.post && this.data.post._id; if (id) this.triggerEvent('openDetail', { id }); },
    onTouchStart() { if (!this.data.pressed) this.setData({ pressed: true }); },
    onTouchEnd() { if (this.data.pressed) this.setData({ pressed: false }); },
    onCardTap() {
      const now = Date.now();
      if (this._lastTap && now - this._lastTap < 300) {
        clearTimeout(this._lastTapTimer);
        this._lastTap = 0;
        this.quickLike();
        return;
      }
      this._lastTap = now;
      this._tapTimer = setTimeout(() => {
        const id = this.data.post && this.data.post._id;
        if (id) this.triggerEvent('openDetail', { id });
      }, 320);
    },
    quickLike() {
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
      const postId = this.data.post && this.data.post._id;
      if (!postId) return;
      this.setData({ showBigHeart: true });
      setTimeout(() => this.setData({ showBigHeart: false }), 600);
      wx.cloud.callFunction({ name: 'manageReaction', data: { postId: this.data.post._id, emoji: '❤️' } })
        .then((res) => { if (res.result && res.result.code === 0) this.setData({ post: res.result.data }); });
    },
    noop() {},
    onReactionButtonTap() { this.setData({ showReactionPopup: !this.data.showReactionPopup }); },
    onReactionSelect(e) {
      const { emoji } = e.currentTarget.dataset;
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
      wx.cloud.callFunction({ name: 'manageReaction', data: { postId: this.data.post._id, emoji } })
        .then((res) => {
          if (res.result && res.result.code === 0) this.setData({ post: res.result.data, showReactionPopup: false });
          else wx.showToast({ title: '操作失败', icon: 'error' });
        })
        .catch(() => wx.showToast({}));
    },
    previewImage(e) {
      const current = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.src;
      const urls = (this.properties.post.images || []).map((u) => u);
      wx.previewImage({ current, urls });
    },
    async onAudioTap(e) {
      const fileUrl = e.currentTarget.dataset.url; if (!fileUrl) return;
      let src = this.audioUrlCache && this.audioUrlCache[fileUrl];
      if (!src) {
        if (fileUrl.startsWith('cloud://')) {
          const res = await wx.cloud.getTempFileURL({ fileList: [fileUrl] });
          src = res.fileList && res.fileList[0] && res.fileList[0].tempFileURL;
        } else { src = fileUrl; }
        this.audioUrlCache[fileUrl] = src;
      }
      if (!src) return;
      this.audioCtx.stop(); this.audioCtx.src = src; this.audioCtx.play();
      this.setData({ isAudioPlaying: true });
    },
    async onMediaTap(e) {
      const idx = Number(e.currentTarget.dataset.index || 0);
      const item = (this.data.mediaDisplay || [])[idx];
      if (!item) return;
      if (item.type === 'video') {
        let url = item.src;
        if (url && url.startsWith('cloud://')) {
          const r = await wx.cloud.getTempFileURL({ fileList: [url] });
          url = r.fileList && r.fileList[0] && r.fileList[0].tempFileURL;
        }
        if (url) wx.previewMedia({ sources: [{ url, type: 'video' }], current: 0 });
      } else {
        const imgs = (this.properties.post.images || []).map((u) => u);
        wx.previewImage({ current: item.src, urls: imgs });
      }
    },
    async onVideoTap(e) {
      const idx = Number(e.currentTarget.dataset.index || 0);
      const files = (this.properties.post.videos || []).map((fileID) => ({ fileID }));
      const res = await wx.cloud.getTempFileURL({ fileList: files.map((f) => f.fileID) });
      const sources = (res.fileList || []).map((x) => ({ url: x.tempFileURL, type: 'video' }));
      if (sources.length) wx.previewMedia({ sources, current: idx });
    },
    toggleImageExpand() { this.setData({ isImageExpanded: !this.data.isImageExpanded }); },
    onMixedImageError(e) {
      const idx = Number(e.currentTarget.dataset.index || 0);
      const list = (this.data.mediaDisplay || []).map((it, i) => (i === idx ? { ...it, error: true, thumb: '/static/home/card3.png' } : it));
      this.setData({ mediaDisplay: list });
