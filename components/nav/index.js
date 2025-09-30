Component({
  options: {
    styleIsolation: 'shared',
  },
  properties: {
    navType: {
      type: String,
      value: 'title',
    },
    titleText: String,
    canBack: { type: Boolean, value: false },
  },
  data: {
    visible: false,
    statusHeight: 0,
    canGoBack: false,
    menuItems: [
      { title: '首页', icon: 'home', url: '/pages/home/index', tab: true },
      { title: '家庭', icon: 'usergroup', url: '/pages/family/index' },
      { title: '设置', icon: 'setting', url: '/pages/setting/index' },
    ],
  },
  lifetimes: {
    ready() {
      const statusHeight = wx.getWindowInfo().statusBarHeight;
      const pages = getCurrentPages();
      this.setData({ statusHeight, canGoBack: pages && pages.length > 1 });
      // Debug signal to verify component is mounted
      try { console.info('[nav] component ready'); } catch (e) {}
    },
  },
  methods: {
    noop() {},
    goBack() {
      const pages = getCurrentPages();
      if (pages && pages.length > 1) {
        wx.navigateBack({ delta: 1 });
      } else {
        wx.switchTab({ url: '/pages/home/index' });
      }
    },
    onDrawerItemClick(e) {
      const { item } = e?.currentTarget?.dataset || {};
      if (!item) return;
      this.closeDrawer();
      if (item.tab) {
        wx.switchTab({ url: item.url });
      } else {
        wx.navigateTo({ url: item.url });
      }
    },
    goTo(e) {
      const url = e?.currentTarget?.dataset?.url;
      if (!url) return;
      this.closeDrawer();
      const tabPages = ['/pages/home/index', '/pages/my/index'];
      if (tabPages.includes(url)) {
        wx.switchTab({ url });
      } else {
        wx.navigateTo({ url });
      }
    },
    openDrawer() {
      this.setData({
        visible: true,
      });
    },
    closeDrawer() {
      this.setData({ visible: false });
    },
    handleLogout() {
      this.closeDrawer();
      const eventBus = getApp().eventBus;
      eventBus.emit('request-logout');
    },

    searchTurn() {
      wx.navigateTo({
        url: `/pages/search/index`,
      });
    },
  },
});
