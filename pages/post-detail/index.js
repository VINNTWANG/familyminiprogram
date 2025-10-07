import dayjs from 'dayjs';
import { emojiList } from '../../config/reactionConfig.js';

Page({
  data: {
    post: null,
    comments: [],
    isLoading: true,
    loadError: false,
    commentInputValue: '',
    i18n: {
      detailTitle: '动态详情',
      errorTitle: '动态加载失败',
      errorSub: '请检查网络或稍后重试',
      commentsTitle: '所有评论',
      emptyText: '还没有评论，快来抢沙发吧～',
      sendLabel: '发送',
      certified: '已认证',
      replyPrefix: '回复'
    },
    inputPlaceholder: '说点什么...',
    inputFocused: false,
    isReplying: false,
    replyInfo: null,
    currentUserInfo: null,
    targetCommentId: null, // Add this to store the target comment ID
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync();
    const screenWidth = systemInfo.screenWidth;
    const statusBarHeightPx = systemInfo.statusBarHeight;
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeightPx = (menuButtonInfo.top - statusBarHeightPx) * 2 + menuButtonInfo.height;
    const rpxRatio = 750 / screenWidth;
    this.setData({
      statusBarHeightRpx: statusBarHeightPx * rpxRatio,
      navBarHeightRpx: navBarHeightPx * rpxRatio
    });

    const postId = options.id;
    if (!postId) {
      this.setData({ isLoading: false, loadError: true });
      return;
    }

    // Check for a commentId to scroll to
    if (options.commentId) {
      this.setData({ targetCommentId: options.commentId });
    }

    this.loadData(postId);
  },

  onUnload() {},

  _flattenComment(comment) {
    if (!comment) return null;
    const flatComment = { ...comment };
    if (comment.authorInfo) {
      flatComment.authorNickName = comment.authorInfo.nickName;
      flatComment.authorAvatarUrl = comment.authorInfo.avatarUrl;
      flatComment.authorIsAdmin = comment.authorInfo.isAdmin;
      flatComment.authorRole = comment.authorInfo.role;
    }
    if (comment.replyToUser) {
      flatComment.replyToNickName = comment.replyToUser.nickName;
    }
    flatComment.time = dayjs(comment.createTime).format('YYYY-MM-DD HH:mm');
    delete flatComment.authorInfo;
    delete flatComment.replyToUser;
    return flatComment;
  },

  async loadData(postId) {
    this.setData({ isLoading: true, loadError: false, comments: [] });
    const db = wx.cloud.database();
    const _ = db.command;
    const myOpenId = wx.getStorageSync('userInfo')?._openid;

    try {
      const [postRes, commentsRes] = await Promise.all([
        db.collection('posts').doc(postId).get(),
        db.collection('comments').where({ postId: postId }).get() // Let processComments handle sorting
      ]);

      let postData = postRes.data;
      let commentsData = commentsRes.data || [];

      if (!postData) {
        this.setData({ isLoading: false, loadError: true });
        return;
      }

      const authorIds = [...new Set([
        postData._openid,
        ...commentsData.map(c => c._openid),
        myOpenId
      ].filter(id => !!id))];
      const usersRes = await db.collection('users').where({ _openid: _.in(authorIds) }).get();
      const usersMap = (usersRes.data || []).reduce((acc, user) => {
        acc[user._openid] = user;
        return acc;
      }, {});
      const enrichWithAuthor = (item) => {
        if (usersMap[item._openid]) {
          item.authorInfo = usersMap[item._openid];
        }
        return item;
      };

      postData = enrichWithAuthor(postData);
      commentsData.forEach(enrichWithAuthor);

      // Media URL resolution can be simplified or kept as is
      // For now, keeping it for consistency
      const allFileIDs = [
        ...(postData.images || []),
        ...(postData.videos || []),
        ...(postData.videoCovers || []),
        ...(Array.isArray(postData.audios) ? postData.audios.map(a => (typeof a === 'string' ? a : a.url)).filter(Boolean) : []),
        ...(postData.authorInfo?.avatarUrl ? [postData.authorInfo.avatarUrl] : []),
        ...commentsData.map(c => c.authorInfo?.avatarUrl).filter(Boolean),
      ].filter(id => id && id.startsWith('cloud://'));

      const uniqueFileIDs = [...new Set(allFileIDs)];
      let urlMap = {};
      if (uniqueFileIDs.length > 0) {
        const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: uniqueFileIDs });
        urlMap = tempUrlRes.fileList.reduce((map, item) => {
          if (item.status === 0) map[item.fileID] = item.tempFileURL;
          return map;
        }, {});
      }

      const resolveUrl = (id) => urlMap[id] || id;
      if (postData.authorInfo?.avatarUrl) {
        postData.authorInfo.avatarUrl = resolveUrl(postData.authorInfo.avatarUrl);
      }
      // ... resolve other media URLs ...

      commentsData.forEach(c => {
        if (c.authorInfo?.avatarUrl) {
          c.authorInfo.avatarUrl = resolveUrl(c.authorInfo.avatarUrl);
        }
      });

      const flattenedComments = commentsData.map(c => this._flattenComment(c));
      const processedComments = this.processComments(flattenedComments);

      postData.time = dayjs(postData.createTime).format('YYYY-MM-DD HH:mm');
      
      this.setData({
        post: postData,
        comments: processedComments,
        currentUserInfo: usersMap[myOpenId] || null,
        isLoading: false,
      });

      // Scroll to the target comment if specified
      this.scrollToComment();

    } catch (err) {
      console.error('[DB] Failed to load post details', err);
      this.setData({ isLoading: false, loadError: true });
    }
  },

  scrollToComment() {
    const { targetCommentId } = this.data;
    if (!targetCommentId) return;

    // Use a timeout to ensure the DOM is updated before querying
    setTimeout(() => {
      const query = wx.createSelectorQuery();
      // Note: The comment item in WXML needs to have the id="comment-{{item._id}}"
      query.select(`#comment-${targetCommentId}`).boundingClientRect();
      query.selectViewport().scrollOffset();
      query.exec((res) => {
        if (res[0]) {
          // Calculate scroll position, considering the fixed navbar height
          const navBarHeightPx = this.data.navBarHeightRpx / (750 / wx.getSystemInfoSync().screenWidth);
          const scrollTop = res[1].scrollTop + res[0].top - navBarHeightPx - 10; // 10px offset
          wx.pageScrollTo({
            scrollTop: scrollTop,
            duration: 300,
          });
        }
      });
    }, 300);
  },

  processComments(comments) {
    const commentMap = {};
    comments.forEach(comment => {
      commentMap[comment._id] = comment;
    });

    comments.forEach(comment => {
      let depth = 0;
      let parent = commentMap[comment.parentCommentId];
      while (parent) {
        depth++;
        parent = commentMap[parent.parentCommentId];
      }
      comment.depth = depth;
    });

    const commentGroups = comments.reduce((acc, comment) => {
      const parentId = comment.parentCommentId || 'root';
      if (!acc[parentId]) acc[parentId] = [];
      acc[parentId].push(comment);
      return acc;
    }, {});

    for (const parentId in commentGroups) {
      commentGroups[parentId].sort((a, b) => new Date(a.createTime) - new Date(b.createTime));
    }

    const sortedComments = [];
    const buildSortedList = (parentId) => {
      if (commentGroups[parentId]) {
        commentGroups[parentId].forEach(child => {
          sortedComments.push(child);
          buildSortedList(child._id);
        });
      }
    };

    buildSortedList('root');
    return sortedComments;
  },

  onPostUpdate(e) {
    const updatedPost = e.detail;
    if (updatedPost && this.data.post && updatedPost._id === this.data.post._id) {
      this.setData({ post: updatedPost });
    }
  },

  onReply(e) {
    const { id, name, openid } = e.currentTarget.dataset;
    this.setData({
      isReplying: true,
      replyInfo: {
        parentCommentId: id,
        nickName: name,
        _openid: openid
      },
      inputPlaceholder: `回复 @${name}`,
      inputFocused: true,
    });
  },

  cancelReply() {
    this.setData({ isReplying: false, replyInfo: null, inputPlaceholder: '说点什么...', inputFocused: false });
  },

  onCommentInputChange(e) {
    this.setData({ commentInputValue: e.detail.value });
  },

  async submitComment() {
    const content = this.data.commentInputValue.trim();
    if (!content) {
      wx.showToast({ title: '评论内容不能为空', icon: 'none' });
      return;
    }

    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '发布中...' });

    const { post, isReplying, replyInfo } = this.data;
    const data = {
      action: 'add',
      postId: post._id,
      content: content,
      parentCommentId: isReplying ? replyInfo.parentCommentId : null,
      replyToUser: isReplying ? { _id: replyInfo._openid, nickName: replyInfo.nickName } : null,
    };

    try {
      const loginRes = await wx.cloud.callFunction({ name: 'login', data: {} });
      if (!loginRes.result || loginRes.result.code !== 0 || !loginRes.result.data.openid) {
        throw new Error('登录检查失败: ' + (loginRes.result?.message || '无法获取 OPENID'));
      }
      data.debugOpenid = loginRes.result.data.openid;

      const res = await wx.cloud.callFunction({ name: 'manageComment', data });
      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '评论成功', icon: 'success' });

        const newComment = {
          _id: res.result.data._id,
          _openid: userInfo._openid,
          authorInfo: this.data.currentUserInfo,
          content: content,
          createTime: new Date(),
          parentCommentId: data.parentCommentId,
          replyToUser: data.replyToUser,
        };

        const flatComment = this._flattenComment(newComment);
        const newCommentsList = this.data.comments.concat([flatComment]);
        const processedComments = this.processComments(newCommentsList);

        this.setData({
          comments: processedComments,
          commentInputValue: '',
          isReplying: false,
          replyInfo: null,
          inputPlaceholder: '说点什么...',
          inputFocused: false,
        });

      } else {
        throw new Error(res.result.message || '评论失败');
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '评论失败，请重试', icon: 'none' });
      console.error('Failed to submit comment', err);
    }
  },

  onDeleteComment(e) {
    const { commentId } = e.currentTarget.dataset;
    const { post } = this.data;

    wx.showModal({
      title: '确认删除',
      content: '您确定要删除这条评论吗？子评论也会被一并删除。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          try {
            const loginRes = await wx.cloud.callFunction({ name: 'login', data: {} });
            if (!loginRes.result || loginRes.result.code !== 0 || !loginRes.result.data.openid) {
              throw new Error('登录检查失败: ' + (loginRes.result?.message || '无法获取 OPENID'));
            }

            const result = await wx.cloud.callFunction({
              name: 'manageComment',
              data: {
                action: 'delete',
                commentId: commentId,
                postId: post._id,
                debugOpenid: loginRes.result.data.openid
              },
            });

            wx.hideLoading();
            if (result.result && result.result.code === 0) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              const newCommentsList = this.data.comments.filter(c => c._id !== commentId);
              const processedComments = this.processComments(newCommentsList);
              this.setData({ comments: processedComments });
            } else {
              throw new Error(result.result.message || '删除失败');
            }
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: err.message || '删除失败，请重试', icon: 'none' });
            console.error('Failed to delete comment', err);
          }
        }
      },
    });
  },

  navigateBack() { wx.navigateBack(); },
});
