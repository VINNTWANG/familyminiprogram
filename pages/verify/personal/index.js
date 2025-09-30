Page({
  data: {
    note: '',
    files: [], // Initialize as an empty array instead of null
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

  handleAdd(e) {
    const { files } = e.detail;
    this.setData({ files: files }); // Store the whole files array
  },

  handleRemove(e) {
    this.setData({ files: [] });
  },

  async handleSubmit() {
    if (!this.data.note.trim() && this.data.files.length === 0) {
      wx.showToast({ title: '请至少填写留言或上传图片', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      let selfieFileID = null;

      // 1. Upload image if it exists
      if (this.data.files.length > 0) {
        const file = this.data.files[0];
        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: `verification_selfies/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`,
          filePath: file.url, // url from t-upload
        });
        selfieFileID = uploadResult.fileID;
      }

      // 2. Call cloud function to submit application
      const dataToSubmit = {
        type: 'personal',
        note: this.data.note,
        selfieFileID: selfieFileID,
      };
      console.log('Submitting PERSONAL verification with data:', dataToSubmit);
      const submissionResult = await wx.cloud.callFunction({
        name: 'submitVerification',
        data: dataToSubmit
      });

      if (submissionResult.result && submissionResult.result.code === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '申请已提交',
          icon: 'success',
          duration: 2000,
        });
        // Navigate back after success
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        throw new Error(submissionResult.result.message || '提交失败');
      }

    } catch (err) {
      wx.hideLoading();
      this.setData({ isSubmitting: false });
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
      console.error('[Submission] Failed', err);
    }
  },
});