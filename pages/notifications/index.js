
import { formatTime } from '../../utils/util';

Page({
  data: {
    notifications: [],
    isLoading: true,
    isRefresherTriggered: false,
    hasMore: true,
    pageNum: 1,
    pageSize: 15,
  },

  onLoad() {
    this.loadData(true);
  },

  onShow() {
    // Mark all as read when the user enters the page
    this.markAllRead();
  },

  async loadData(reset = false) {
    if (this.data.isLoading && !reset) return;

    if (reset) {
      this.setData({ pageNum: 1, hasMore: true, notifications: [] });
    }

    this.setData({ isLoading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'getNotificationList',
        data: {
          pageNum: this.data.pageNum,
          pageSize: this.data.pageSize,
        }
      });

      if (res.result && res.result.code === 0) {
        const newNotifications = res.result.data || [];
        const processedNotifications = newNotifications.map(item => {
          return {
            ...item,
            createTimeFormatted: formatTime(new Date(item.createTime)),
          };
        });

        this.setData({
          notifications: reset ? processedNotifications : [...this.data.notifications, ...processedNotifications],
          pageNum: this.data.pageNum + 1,
          hasMore: newNotifications.length === this.data.pageSize,
        });
      } else {
        throw new Error(res.result.message || 'Failed to load notifications');
      }
    } catch (e) {
      console.error('[loadData] error', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false, isRefresherTriggered: false });
    }
  },

  async markAllRead() {
    try {
      await wx.cloud.callFunction({ name: 'markNotificationsAsRead' });
      // Refresh the home page's notification count when returning
      const eventBus = getApp().eventBus;
      eventBus.emit('refreshNotifications');
    } catch (e) {
      console.error('[markAllRead] failed', e);
    }
  },

  onRefresherRefresh() {
    this.setData({ isRefresherTriggered: true });
    this.loadData(true);
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadData();
    }
  },

  onNotificationTap(e) {
    const { postid, commentid } = e.currentTarget.dataset;
    if (postid) {
      let url = `/pages/post-detail/index?id=${postid}`;
      if (commentid) {
        url += `&commentId=${commentid}`;
      }
      wx.navigateTo({
        url: url
      });
    }
  },
});
