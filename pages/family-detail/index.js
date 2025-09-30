import { formatTime } from '../../utils/util';

Page({
  data: { family: null, members: [], posts: [] },

  onLoad(options) {
    const familyId = options.id;
    if (familyId) {
      this.load(familyId);
    }
  },

  async load(familyId) {
    const db = wx.cloud.database();
    const _ = db.command;

    // 找到指定的家庭
    const fr = await db.collection('families').doc(familyId).get();
    const family = fr.data || null;

    if (!family) {
      this.setData({ family: null, members: [], posts: [] });
      return;
    }
    this.setData({ family });

    // 加载成员资料
    const ur = await db.collection('users').where({ _openid: _.in(family.members || []) }).get();
    const members = (ur.data || []).map(u => ({ _openid: u._openid, nickName: u.nickName, avatarUrl: u.avatarUrl }));
    this.setData({ members });

    // 加载成员动态
    const pr = await db.collection('posts').where({ _openid: _.in(family.members || []) }).orderBy('createTime', 'desc').limit(30).get();
    const posts = (pr.data || []).map(post => ({
      ...post,
      author: post.authorInfo ? post.authorInfo : { nickName: '默认用户', avatarUrl: '' },
      timestamp: post.createTime ? formatTime(post.createTime) : '未知时间',
    }));
    this.setData({ posts });
  },

  openDetailFromCard(e) {
    const id = e && e.detail && e.detail.id;
    if (id) wx.navigateTo({ url: `/pages/post-detail/index?id=${id}` });
  },
});
