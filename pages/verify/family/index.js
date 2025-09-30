Page({
  data: {
    note: '',
    isSubmitting: false,
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

  onNoteChange(e) {
    this.setData({ note: e.detail.value });
  },

  async handleSubmit() {
    if (!this.data.note.trim()) {
      wx.showToast({ title: '请填写关系说明', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      const dataToSubmit = {
        type: 'family',
        note: this.data.note,
      };
      console.log('Submitting FAMILY verification with data:', dataToSubmit);
      const res = await wx.cloud.callFunction({
        name: 'submitVerification',
        data: dataToSubmit
      });

      if (res.result && res.result.code === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '申请已提交',
          icon: 'success',
          duration: 2000,
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        throw new Error(res.result.message || '提交失败');
      }

    } catch (err) {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
      console.error('[Family Submission] Failed', err);
    }
  },
});