// app.js
import config from './config';
import Mock from './mock/index';
import createBus from './utils/eventBus';
import { connectSocket, fetchUnreadNum } from './mock/chat';

if (config.isMock) {
  Mock();
}

App({
  onLaunch() {
    // 初始化云环境
    try {
      wx.cloud.init({
        env: 'cloud1-9g6fy6vgc0c01f3d', // Directly hardcode the confirmed environment ID
        traceUser: true,
      });
      console.log('Cloud init success!');
    } catch (e) {
      console.error('wx.cloud.init failed', e);
    }
    // 初始化数据库集合（存在则忽略）
    wx.cloud.callFunction({ name: 'initDb' }).catch(() => {});

    this.globalData.TDesign = { useIconFont: false };

    const updateManager = wx.getUpdateManager();
    updateManager.onCheckForUpdate(() => {});
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success(res) { if (res.confirm) updateManager.applyUpdate(); },
      });
    });

    this.getUnreadNum();
    this.connect();
  },
  globalData: {
    userInfo: null,
    unreadNum: 0,
    socket: null,
  },

  eventBus: createBus(),

  connect() {
    const socket = connectSocket();
    socket.onMessage((data) => {
      data = JSON.parse(data);
      if (data.type === 'message' && !data.data.message.read) this.setUnreadNum(this.globalData.unreadNum + 1);
    });
    this.globalData.socket = socket;
  },

  getUnreadNum() {
    fetchUnreadNum().then(({ data }) => {
      this.globalData.unreadNum = data;
      this.eventBus.emit('unread-num-change', data);
    });
  },

  setUnreadNum(unreadNum) {
    this.globalData.unreadNum = unreadNum;
    this.eventBus.emit('unread-num-change', unreadNum);
  },
});

