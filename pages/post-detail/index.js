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
    delete flatComment.authorInfo;
    delete flatComment.replyToUser;
    return flatComment;
  },

  async loadData(postId) {
    this.setData({ isLoading: true, loadError: false });
    const db = wx.cloud.database();
    const _ = db.command;
    const myOpenId = wx.getStorageSync('userInfo')?._openid;

    try {
      const [postRes, commentsRes] = await Promise.all([
        db.collection('posts').doc(postId).get(),
        db.collection('comments').where({ postId: postId }).orderBy('createTime', 'asc').get()
      ]);

      let postData = postRes.data;
      console.log('Post Data:', postData);
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
        try {
          const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: uniqueFileIDs });
          urlMap = tempUrlRes.fileList.reduce((map, item) => {
            if (item.status === 0) map[item.fileID] = item.tempFileURL;
            return map;
          }, {});
        } catch (e) {
          console.error('[getTempFileURL] Failed', e);
        }
      }

      const resolveUrl = (id) => urlMap[id] || id;
      if (postData.authorInfo?.avatarUrl) {
        postData.authorInfo.avatarUrl = resolveUrl(postData.authorInfo.avatarUrl);
      }
      postData.images = (postData.images || []).map(resolveUrl);
      postData.videos = (postData.videos || []).map(resolveUrl);
      postData.videoCovers = (postData.videoCovers || []).map(resolveUrl);
      if (postData.audios && postData.audios.length > 0) {
        postData.audios = postData.audios.map(a => {
          if (typeof a === 'string') return { url: resolveUrl(a) };
          return { ...a, url: resolveUrl(a.url) };
        });
      }

      commentsData.forEach(c => {
        if (c.authorInfo?.avatarUrl) {
          c.authorInfo.avatarUrl = resolveUrl(c.authorInfo.avatarUrl);
        }
      });

      const flattenedComments = commentsData.map(c => this._flattenComment(c));
      const commentTree = this.buildCommentTree(flattenedComments);

      postData.time = dayjs(postData.createTime).format('YYYY-MM-DD HH:mm');
      
      this.setData({
        post: postData,
        comments: commentTree,
        currentUserInfo: usersMap[myOpenId] || null,
        isLoading: false,
      });

    } catch (err) {
      console.error('[DB] Failed to load post details', err);
      this.setData({ isLoading: false, loadError: true });
    }
  },

  buildCommentTree(comments) {
    const commentMap = {};
    const rootComments = [];
    comments.forEach(comment => {
      comment.children = [];
      commentMap[comment._id] = comment;
    });
    comments.forEach(comment => {
      if (comment.parentCommentId) {
        const parent = commentMap[comment.parentCommentId];
        if (parent) {
          parent.children.push(comment);
        } else {
          rootComments.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });
    return rootComments;
  },

  onPostUpdate(e) {
    const updatedPost = e.detail;
    if (updatedPost && this.data.post && updatedPost._id === this.data.post._id) {
      this.setData({ post: updatedPost });
    }
  },

  onReply(e) {
    const comment = e.currentTarget.dataset.comment;
    this.setData({
      isReplying: true,
      replyInfo: {
        parentCommentId: comment._id,
        nickName: comment.authorNickName,
        _openid: comment._openid
      },
      inputPlaceholder: `回复 @${comment.authorNickName}`,
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
          children: [],
        };

        const flatComment = this._flattenComment(newComment);
        this.addCommentToTree(flatComment);

        this.setData({
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

  addCommentToTree(newComment) {
    const comments = this.data.comments;
    if (newComment.parentCommentId) {
      const findAndAdd = (nodes) => {
        for (let node of nodes) {
          if (node._id === newComment.parentCommentId) {
            node.children.push(newComment);
            return true;
          }
          if (node.children && node.children.length > 0) {
            if (findAndAdd(node.children)) return true;
          }
        }
        return false;
      };
      findAndAdd(comments);
    } else {
      comments.push(newComment);
    }
    this.setData({ comments: comments });
  },

  navigateBack() { wx.navigateBack(); },
});
