import { formatTime } from '../../utils/util';

Page({
  data: {
    userInfo: null,
    userPosts: [],
  },

  onLoad(options) {
    const openidFromQuery = options && options._openid;
    const userInfo = wx.getStorageSync('userInfo');
    const targetOpenid = openidFromQuery || (userInfo && userInfo._openid) || '';
    if (!targetOpenid) { wx.showToast({ title: '未找到用户', icon: 'none' }); return; }
    this.fetchUserProfile(targetOpenid);
    this.fetchUserPosts(targetOpenid);
  },

  fetchUserProfile(openid) {
    const db = wx.cloud.database();
    db.collection('users')
      .where({ _openid: openid })
      .get()
      .then((res) => {
        const info = res.data && res.data[0];
        if (info) this.setData({ userInfo: info });
      })
      .catch((e) => console.error('获取用户信息失败', e));
  },

  fetchUserPosts(openid) {
    const db = wx.cloud.database();
    db.collection('posts')
      .where({ _openid: openid })
      .orderBy('createTime', 'desc')
      .get()
      .then((res) => {
        const posts = res.data.map((post) => ({
          ...post,
          author: post.authorInfo || { nickName: '默认用户', avatarUrl: '' },
          timestamp: post.createTime ? formatTime(post.createTime) : '未知时间',
        }));
        this.setData({ userPosts: posts });
      })
      .catch((e) => console.error('获取用户动态失败', e));
  },

  openDetailFromCard(e) {
    const id = e && e.detail && e.detail.id;
    if (id) wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
  },
});

