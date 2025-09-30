import { emojiList } from '../../config/reactionConfig.js';
const eventBus = getApp().eventBus;

Component({
  properties: {
    post: {
      type: Object,
      value: {},
    },
    currentUserInfo: {
      type: Object,
      value: null,
    },
  },

  lifetimes: {
    attached() {
      // Initialize derived reaction states on mount
      const reactions = this.data.post?.reactions || [];
      this._updateReactionState(reactions);
      // Measure content for folding
      this._measureContentForFold();
    },
  },

  data: {
    innerAudioContext: null,
    showReactionPanel: false,
    availableReactions: emojiList,
    likeAnimationClass: '',
    // Derived UI states (avoid writing into bound prop `post.*`)
    reactionSummary: [],
    liked: false,
    likeCount: 0,
    // fold state
    foldable: false,
    folded: false,
    maxFoldLines: 4,
  },

  observers: {
    'post.reactions': function(reactions) {
      if (reactions) {
        this._updateReactionState(reactions);
      }
    }
  },

  detached() {
    // Cleanup audio context on component unload
    if (this.data.innerAudioContext) {
      this.data.innerAudioContext.destroy();
    }
  },

  methods: {
    _measureContentForFold() {
      // Configure folding lines
      const MAX_LINES = 4;
      // read computed height and line-height
      const query = this.createSelectorQuery().in(this);
      query.select('.content-text').fields({ size: true, computedStyle: ['lineHeight'] }, (res) => {
        if (!res) return;
        const lineHeight = parseFloat(res.lineHeight || '0') || 0;
        const maxHeight = lineHeight > 0 ? lineHeight * MAX_LINES : 0;
        // only enable fold when actual height exceeds threshold
        const shouldFold = maxHeight > 0 && res.height > maxHeight + 2; // small tolerance
        if (shouldFold) {
          this.setData({ foldable: true, folded: true, maxFoldLines: MAX_LINES });
        } else {
          this.setData({ foldable: false, folded: false, maxFoldLines: MAX_LINES });
        }
      }).exec();
    },

    // Navigate to detail page when card is tapped
    onCardTap() {
      if (this.data.showReactionPanel) return; // Prevent navigation when panel is open
      this.triggerEvent('openDetail', { id: this.data.post._id });
    },

    onToggleFold() {
      if (!this.data.foldable) return;
      this.setData({ folded: !this.data.folded });
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
        .map(k => ({ emoji: k, count: counts[k] }))
        .sort((a, b) => b.count - a.count);

      // Check if liked by current user
      const liked = reactions.some(r => r.openid === myOpenId && r.emoji === '❤️');
      const likeCount = summary.find(r => r.emoji === '❤️')?.count || 0;

      this.setData({
        reactionSummary: summary,
        liked,
        likeCount,
      });
    },

    // Navigate to detail page when comment button is tapped
    onComment() {
      this.triggerEvent('openDetail', { id: this.data.post._id });
    },

    onLike() {
      // Trigger animation
      this.setData({ likeAnimationClass: 'like-animation' });
      setTimeout(() => {
        this.setData({ likeAnimationClass: '' });
      }, 400); // Animation duration is 300ms, timeout is slightly longer

      this.onSelectReaction({ currentTarget: { dataset: { emoji: '❤️' } } });
    },

    onMoreOptions() {
      this.triggerEvent('showoptions', { post: this.data.post });
    },

    onToggleReactionPanel() {
      this.setData({ showReactionPanel: !this.data.showReactionPanel });
    },

    onSelectReaction(e) {
      const emoji = e.currentTarget.dataset.emoji;
      const post = this.data.post;
      const myOpenId = wx.getStorageSync('userInfo')?._openid;

      if (!myOpenId) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }

      // Optimistic update
      const reactions = post.reactions || [];
      const existingReactionIndex = reactions.findIndex(r => r.openid === myOpenId && r.emoji === emoji);

      if (existingReactionIndex > -1) {
        reactions.splice(existingReactionIndex, 1);
      } else {
        reactions.push({ openid: myOpenId, emoji: emoji });
      }

      this.setData({
        'post.reactions': reactions,
        showReactionPanel: false,
      });
      // Update derived state immediately for responsiveness
      this._updateReactionState(reactions);

      // Call cloud function to update backend
      wx.cloud.callFunction({
        name: 'manageReaction',
        data: { 
          postId: post._id,
          emoji: emoji 
        }
      }).then(res => {
        if (res.result && res.result.code === 0) {
          // Update with the definitive state from the server
          this.setData({ 'post.reactions': res.result.data.reactions });
          // Emit event for other pages to update
          eventBus.emit('post-updated', { postId: post._id, reactions: res.result.data.reactions });
        } else {
          // TODO: Revert optimistic update on failure
          console.error('Reaction update failed', res);
        }
      }).catch(err => {
        // TODO: Revert optimistic update on failure
        console.error('Reaction cloud function error', err);
      });
    },

    // Audio Player Logic
    playAudio() {
      const audio = this.data.post.displayAudio;
      if (!audio || !audio.url) return;

      if (this.data.post.displayAudio.playing) {
        if (this.data.innerAudioContext) {
          this.data.innerAudioContext.stop();
        }
        return;
      }

      if (this.data.innerAudioContext) {
        this.data.innerAudioContext.destroy();
      }

      const innerAudioContext = wx.createInnerAudioContext();
      this.setData({ innerAudioContext });
      innerAudioContext.src = audio.url;
      innerAudioContext.play();

      innerAudioContext.onPlay(() => {
        this.setData({ 'post.displayAudio.playing': true });
      });

      const stopAudio = () => {
        this.setData({ 'post.displayAudio.playing': false });
        if (this.data.innerAudioContext) {
          this.data.innerAudioContext.destroy();
          this.setData({ innerAudioContext: null });
        }
      };

      innerAudioContext.onStop(stopAudio);
      innerAudioContext.onEnded(stopAudio);
      innerAudioContext.onError((res) => {
        console.error('Audio error', res.errMsg);
        wx.showToast({ title: '语音播放失败', icon: 'none' });
        stopAudio();
      });
    }
  }
});
