import { emojiList } from '../../config/reactionConfig.js';

Component({
  properties: {
    post: {
      type: Object,
      value: {},
    },
    hideFooter: {
      type: Boolean,
      value: false,
    },
    isAdmin: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    showReactionPopup: false,
    isAudioPlaying: false,
    displayAudio: null,
    mediaDisplay: [],
    pressed: false,
    isHot: false,
    authorBadge: '',
    showBigHeart: false,
    likeCount: 0,
    displayReactions: [],
    availableReactions: emojiList,
  },

  lifetimes: {
    attached() {
      const app = getApp(); // MOVED TO THE CORRECT LOCATION
      this.audioCtx = wx.createInnerAudioContext({ obeyMuteSwitch: false });
      this.eventBus = app.eventBus;

      this.handleGlobalAudioPlay = (sourceId) => {
        if (this.data.isAudioPlaying && this.id !== sourceId) {
          this.audioCtx.stop();
        }
      };
      this.eventBus.on('audio-play-started', this.handleGlobalAudioPlay);

      this.audioCtx.onPlay(() => this.setData({ isAudioPlaying: true }));
      this.audioCtx.onStop(() => this.setData({ isAudioPlaying: false }));
      this.audioCtx.onEnded(() => this.setData({ isAudioPlaying: false }));
      this.audioCtx.onError(() => this.setData({ isAudioPlaying: false }));
      
      this.audioCtx.onTimeUpdate(() => {
        if (this.data.isAudioPlaying) {
          const currentTime = this.audioCtx.currentTime;
          const newTimeStr = this._formatDuration(currentTime);
          if (newTimeStr !== this.data.displayAudio.durationStr) {
            this.setData({ 'displayAudio.durationStr': newTimeStr });
          }
        }
      });
    },
    detached() {
      if (this.audioCtx) {
        this.audioCtx.destroy();
      }
      if (this.eventBus) {
        this.eventBus.off('audio-play-started', this.handleGlobalAudioPlay);
      }
    },
  },

  observers: {
    async post(p) {
      if (!p || !p._id) return;
      let post = { ...p };

      // --- Full Media Processing ---
      const fileIDs = [
        ...(Array.isArray(post.images) ? post.images : []),
        ...(Array.isArray(post.videos) ? post.videos : []),
        ...(Array.isArray(post.videoCovers) ? post.videoCovers : []),
        ...(Array.isArray(post.audios) ? post.audios.map(a => (typeof a === 'string' ? a : a.url)).filter(Boolean) : []),
        ...(post.authorInfo && post.authorInfo.avatarUrl ? [post.authorInfo.avatarUrl] : []),
      ].filter((url) => url && typeof url === 'string' && url.startsWith('cloud://'));

      let urlMap = {};
      if (fileIDs.length > 0) {
        try {
          const res = await wx.cloud.getTempFileURL({ fileList: fileIDs });
          urlMap = (res.fileList || []).reduce((acc, cur) => {
            if (cur.status === 0) acc[cur.fileID] = cur.tempFileURL;
            return acc;
          }, {});
        } catch (e) { console.error('post-card getTempFileURL failed', e); }
      }

      if (Array.isArray(post.images)) post.images = post.images.map((id) => urlMap[id] || id);
      if (Array.isArray(post.videos)) post.videos = post.videos.map((id) => urlMap[id] || id);
      if (Array.isArray(post.videoCovers)) post.videoCovers = post.videoCovers.map((id) => urlMap[id] || id);
      if (post.authorInfo && post.authorInfo.avatarUrl && urlMap[post.authorInfo.avatarUrl]) {
        post.authorInfo.avatarUrl = urlMap[post.authorInfo.avatarUrl];
      }

      const imgs = post.images || [];
      const vids = post.videos || [];
      const media = [];
      imgs.forEach((u) => media.push({ type: 'image', thumb: u, src: u }));
      vids.forEach((v, i) => media.push({ type: 'video', thumb: (post.videoCovers && post.videoCovers[i]) || imgs[0] || '', src: v }));

      // --- Audio Processing ---
      let displayAudio = null;
      if (p.audios && p.audios.length > 0) {
        const audioData = p.audios[0];
        let audioUrl = null;
        let audioDuration = 0;
        if (typeof audioData === 'string') {
          audioUrl = audioData;
        } else if (audioData && typeof audioData.url === 'string') {
          audioUrl = audioData.url;
          audioDuration = audioData.duration || 0;
        }
        
        const resolvedUrl = urlMap[audioUrl] || audioUrl;

        if (resolvedUrl) {
          displayAudio = {
            ...(typeof audioData === 'object' ? audioData : {}),
            url: resolvedUrl,
            duration: audioDuration,
            durationStr: this._formatDuration(audioDuration),
          };
        }
      }

      const hotScore = (Array.isArray(p.reactions) ? p.reactions.length : 0) + (p.commentCount || 0);
      const authorBadge = (this.properties.isAdmin) ? '' : (p.authorInfo && p.authorInfo.role) || '';

      this.setData({
        mediaDisplay: media,
        displayAudio,
        isHot: hotScore >= 10,
        authorBadge: authorBadge,
      });

      this._updateReactionState(p.reactions);
    },
  },

  methods: {
    _formatDuration(seconds) {
      if (isNaN(seconds)) return '0:00';
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      const formattedSeconds = remainingSeconds < 10 ? `0${remainingSeconds}` : `${remainingSeconds}`;
      return `${minutes}:${formattedSeconds}`;
    },

    _updateReactionState(reactions = []) {
      const myOpenId = wx.getStorageSync('userInfo')?._openid;

      // Calculate summary
      const counts = reactions.reduce((acc, cur) => {
        const k = cur.emoji;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const summary = Object.keys(counts)
        .map(k => ({ 
          emoji: k, 
          count: counts[k],
          reacted: reactions.some(r => r.openid === myOpenId && r.emoji === k)
        }))
        .sort((a, b) => b.count - a.count);

      // Check if liked by current user
      const liked = reactions.some(r => r.openid === myOpenId && r.emoji === '❤️');
      const likeCount = counts['❤️'] || 0;

      this.setData({
        displayReactions: summary,
        liked,
        likeCount,
      });
    },

    async onAudioTap(e) {
      if (!this.data.displayAudio || !this.data.displayAudio.url) return;
      if (this.data.isAudioPlaying) {
        this.audioCtx.stop();
        return;
      }
      this.eventBus.emit('audio-play-started', this.id);
      try {
        let src = this.data.displayAudio.url;
        if (src.startsWith('cloud://')) {
          const res = await wx.cloud.getTempFileURL({ fileList: [src] });
          if (res.fileList && res.fileList[0] && res.fileList[0].status === 0) {
            src = res.fileList[0].tempFileURL;
          } else { throw new Error('Failed to get temp audio URL'); }
        }
        this.audioCtx.src = src;
        this.audioCtx.play();
      } catch (err) {
        wx.showToast({ title: '音频播放失败', icon: 'none' });
        console.error('Audio play error:', err);
      }
    },

    onCardTap() {
      const id = this.data.post && this.data.post._id;
      if (id) this.triggerEvent('openDetail', { id });
    },
    
    onLike() { this.quickLike(); },
    onComment() { this.onCardTap(); },
    onTouchStart() { if (!this.data.pressed) this.setData({ pressed: true }); },
    onTouchEnd() { if (this.data.pressed) this.setData({ pressed: false }); },
    quickLike() {
      this.onSelectReaction({ currentTarget: { dataset: { emoji: '❤️' } } });
    },
    noop() {},
    onToggleReactionPanel() {
      this.setData({ showReactionPopup: !this.data.showReactionPopup });
    },
    onSelectReaction(e) {
      const { emoji } = e.currentTarget.dataset;
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      const postId = this.data.post?._id;
      if (!postId) return;

      // Optimistic update
      const reactions = this.data.post.reactions || [];
      const myOpenid = userInfo._openid;
      const existingReactionIndex = reactions.findIndex(r => r.openid === myOpenid && r.emoji === emoji);

      if (existingReactionIndex > -1) {
        reactions.splice(existingReactionIndex, 1);
      } else {
        reactions.push({ openid: myOpenid, emoji: emoji });
      }
      
      this.setData({ 
        'post.reactions': reactions,
        showReactionPopup: false 
      });
      this._updateReactionState(reactions);

      wx.cloud.callFunction({
        name: 'manageReaction',
        data: { postId, emoji },
      }).then(res => {
        if (res.result && res.result.code === 0) {
          this.triggerEvent('updatepost', res.result.data);
          // Sync with final server state
          this.setData({ 'post.reactions': res.result.data.reactions });
          this._updateReactionState(res.result.data.reactions);
        } else {
          // TODO: Revert optimistic update
          wx.showToast({ title: '操作失败', icon: 'error' });
        }
      }).catch(() => {
        // TODO: Revert optimistic update
        wx.showToast({ title: '操作失败', icon: 'error' });
      });
    },
    previewImage(e) {
      const current = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.src;
      const urls = (this.properties.post.images || []).map((u) => u);
      wx.previewImage({ current, urls });
    },
    onMediaTap(e) {
      const idx = Number(e.currentTarget.dataset.index || 0);
      const item = (this.data.mediaDisplay || [])[idx];
      if (!item) return;
      if (item.type === 'video') {
        wx.previewMedia({ sources: [{ url: item.src, type: 'video' }], current: 0 });
      } else {
        const imgs = (this.properties.post.images || []).map((u) => u);
        wx.previewImage({ current: item.src, urls: imgs });
      }
    },
  },
});