Page({
  data: { families: [] },

  onShow() {
    this.load();
  },

  async load() {
    const db = wx.cloud.database();
    const res = await db.collection('families').get();
    this.setData({ families: res.data });
  },

  navigateToFamilyDetail(e) {
    const familyId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/family-detail/index?id=${familyId}` });
  },
});
