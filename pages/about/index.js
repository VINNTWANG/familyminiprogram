Page({
  data: {
    statusBarHeightRpx: 0,
    navBarContentHeightRpx: 0,
  },

  onLoad() {
    // Calculate safe area for custom navbar
    const systemInfo = wx.getSystemInfoSync();
    const screenWidth = systemInfo.screenWidth;
    const statusBarHeightPx = systemInfo.statusBarHeight;
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarContentHeightPx = (menuButtonInfo.top - statusBarHeightPx) * 2 + menuButtonInfo.height;
    const rpxRatio = 750 / screenWidth;

    this.setData({
      statusBarHeightRpx: statusBarHeightPx * rpxRatio,
      navBarContentHeightRpx: navBarContentHeightPx * rpxRatio,
    });
  },

  navigateBack() {
    wx.navigateBack();
  },
});
