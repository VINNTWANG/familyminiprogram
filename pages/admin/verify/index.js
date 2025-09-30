const dayjs = require('dayjs');

Page({
  data: {
    applications: [],
    processedApplications: [],
    isLoading: true,
    activeTab: 'pending', // 'pending' or 'processed'
    statusBarHeightRpx: 0,
    navBarContentHeightRpx: 0,
    families: ['王迎凤家', '王天才家', '王天喜家', '王天祥家', '王润德家'],
  },

  onLoad() {
    console.log('Admin page onLoad triggered.');
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

    this.syncFamilies();
  },

  async syncFamilies() {
    try {
      console.log('Calling syncFamilies cloud function...');
      const res = await wx.cloud.callFunction({
        name: 'manageFamily',
        data: {
          action: 'sync',
          names: this.data.families
        }
      });
      console.log('syncFamilies call successful. Result:', res.result);
    } catch (e) {
      console.error('[Family Sync] Failed:', e);
      // Optional: show a toast to the admin if sync fails
    }
  },

  navigateBack() {
    wx.navigateBack();
  },

  onShow() {
    this.loadVerifications();
  },

  handleTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.activeTab) {
      this.setData({ activeTab: tab });
      this.loadVerifications();
    }
  },

  async loadVerifications() {
    this.setData({ isLoading: true });

    try {
      let applications = [];
      if (this.data.activeTab === 'pending') {
        const res = await wx.cloud.callFunction({
          name: 'adminAction',
          data: { action: 'getPendingVerifications' }
        });
        if (res.result && res.result.code === 0) {
          applications = res.result.data || [];
        } else {
          const errorMessage = (res.result && res.result.message) || '获取待审核列表失败';
          throw new Error(errorMessage);
        }
      } else {
        const db = wx.cloud.database();
        const _ = db.command;
        const statusQuery = _.in(['approved', 'rejected']);
        const res = await db.collection('verifications').where({ status: statusQuery }).orderBy('createTime', 'desc').get();
        applications = res.data || [];
      }

      const fileIDs = applications.map(app => app.selfieFileID).filter(id => !!id);
      if (fileIDs.length > 0) {
        const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: fileIDs });
        const urlMap = tempUrlRes.fileList.reduce((acc, cur) => {
          if (cur.status === 0) acc[cur.fileID] = cur.tempFileURL;
          return acc;
        }, {});

        applications.forEach(app => {
          if (app.selfieFileID && urlMap[app.selfieFileID]) {
            app.selfieUrl = urlMap[app.selfieFileID];
          }
        });
      }

      applications.forEach(app => {
        app.createTime = dayjs(app.createTime).format('YYYY-MM-DD HH:mm');
      });

      if (this.data.activeTab === 'pending') {
        this.setData({ applications, isLoading: false });
      } else {
        this.setData({ processedApplications: applications, isLoading: false });
      }

    } catch (err) {
      console.error('Failed to load verifications', err);
      this.setData({ isLoading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    if (src) {
      wx.previewImage({ urls: [src] });
    }
  },

  handleApprove(e) {
    const { id, type, familyName } = e.currentTarget.dataset;
    const action = type === 'family' ? 'approveFamilyVerification' : 'approveVerification';
    this.performAction(action, id, '通过', familyName);
  },

  handleReject(e) {
    const id = e.currentTarget.dataset.id;
    this.performAction('rejectVerification', id, '驳回');
  },

  async performAction(action, verificationId, actionText, familyName = null) {
    wx.showLoading({ title: '处理中...' });
    try {
      const data = {
        action: action,
        verificationId: verificationId,
      };
      if (familyName) {
        data.familyName = familyName;
      }

      const res = await wx.cloud.callFunction({
        name: 'adminAction',
        data: data
      });

      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: `操作成功：已${actionText}`, icon: 'success' });
        this.loadVerifications(); // Refresh the list
      } else {
        throw new Error((res.result && res.result.message) || '操作失败');
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '操作失败，请检查权限或网络', icon: 'none' });
      console.error('[Admin Action] Failed', err);
    }
  }
});