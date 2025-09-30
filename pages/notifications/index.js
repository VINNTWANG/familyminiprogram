Page({
  data: { unread: [], read: [] },
  onShow() { this.load(); },
  async load() {
    const user = wx.getStorageSync('userInfo');
    if (!user || !user._openid) return;
    const db = wx.cloud.database();
    const res = await db.collection('notifications').where({ toOpenid: user._openid }).orderBy('createTime','desc').get();
    const list = res.data || [];
    this.setData({ unread: list.filter(i=>!i.read), read: list.filter(i=>!!i.read) });
  },
  formatTitle(item) {
    if (item.type === 'comment') return '有新评论';
    if (item.type === 'verification') return item.result === 'approved' ? '认证已通过' : '认证未通过';
    return '通知';
  },
  formatNote(item) {
    if (item.type === 'comment') return (item.from && item.from.nickName ? item.from.nickName + ': ' : '') + (item.content || '...');
    if (item.type === 'verification') return (item.verifyType === 'personal' ? '个人认证' : '家庭认证') + (item.result==='approved'?'已通过':'被驳回');
    return '';
  },
  async onMarkRead(e) {
    const id = e.currentTarget.dataset.id; if (!id) return;
    const db = wx.cloud.database();
    try { await db.collection('notifications').doc(id).update({ data: { read: true } }); this.load(); } catch (e) {}
  },
  onOpen(e) {
    const id = e.currentTarget.dataset.id; if (!id) return;
    const all = [...this.data.unread, ...this.data.read];
    const item = all.find(i=>i._id===id);
    if (item && item.type==='comment' && item.postId) wx.navigateTo({ url: `/pages/post-detail/index?id=${item.postId}` });
  }
});