
const db = wx.cloud.database();

Page({
  data: {
    images: [],
    isLoading: true,
    hasMore: true,
    pageSize: 21, // 3 columns, 7 rows
    lastCreateTime: null,
  },

  onLoad: function (options) {
    this.loadImages(true);
  },

  async loadImages(reset = false) {
    if (!reset && !this.data.hasMore) return;
    this.setData({ isLoading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'getPosts',
        data: {
          pageSize: this.data.pageSize,
          lastCreateTime: reset ? null : this.data.lastCreateTime,
          imageOnly: true, // Custom flag for this cloud function
        },
      });

      const posts = res.result || [];
      if (posts.length === 0) {
        this.setData({ hasMore: false, isLoading: false });
        return;
      }

      const allImageIds = posts.flatMap(post => post.images || []);
      if (allImageIds.length === 0) {
        this.setData({ isLoading: false });
        if (posts.length < this.data.pageSize) {
          this.setData({ hasMore: false });
        } else {
          // If no images in this batch, but there might be more posts, try loading next page
          const lastPost = posts[posts.length - 1];
          this.setData({ lastCreateTime: lastPost.createTime }, () => this.loadImages());
        }
        return;
      }

      const tempUrlRes = await wx.cloud.getTempFileURL({ fileList: allImageIds });
      const urlMap = tempUrlRes.fileList.reduce((map, item) => {
        if (item.status === 0) map[item.fileID] = item.tempFileURL;
        return map;
      }, {});

      const newImages = posts.flatMap(post => 
        (post.images || []).map(id => ({
          src: urlMap[id] || '', // The image URL for display
          postId: post._id, // The ID of the post it belongs to
        }))
      ).filter(img => img.src); // Filter out any images that failed to get a URL

      const currentImages = reset ? [] : this.data.images;
      this.setData({
        images: [...currentImages, ...newImages],
        hasMore: posts.length === this.data.pageSize,
        lastCreateTime: posts[posts.length - 1].createTime,
      });

    } catch (e) {
      console.error('Failed to load images for photo wall', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  onReachBottom: function () {
    this.loadImages();
  },

  onPullDownRefresh: function () {
    this.loadImages(true).finally(() => wx.stopPullDownRefresh());
  },
});
