import dayjs from 'dayjs';

Page({
  data: {
    historyWords: [],
    popularWords: [],
    searchValue: '',
    searchResults: [],
    isLoading: false,
    noResults: false,
    showResults: false,
  },

  onShow() {
    if (!this.data.showResults) {
      this.queryHistory();
      this.queryPopular();
    }
  },

  queryHistory() {
    const mockHistory = ['小程序', 'user:camilo', 'TDesign'];
    this.setData({ historyWords: mockHistory });
  },

  queryPopular() {
    const mockPopular = ['云函数', '数据库', '微信'];
    this.setData({ popularWords: mockPopular });
  },

  onFormSubmit(e) {
    const keyword = e.detail.value.keyword.trim();
    if (!keyword) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    this.setData({ searchValue: keyword });
    this.setHistoryWords(keyword);
    this.executeSearch(keyword);
  },

  async executeSearch(keyword) {
    this.setData({
      isLoading: true,
      showResults: true,
      noResults: false,
      searchResults: [],
    });

    let cloudPayload = {};

    if (keyword.toLowerCase().startsWith('user:')) {
      const username = keyword.substring(5).trim();
      if (!username) {
        this.setData({ isLoading: false, noResults: true });
        wx.showToast({ title: '请输入要搜索的用户名', icon: 'none' });
        return;
      }
      cloudPayload = { username: username };
    } else {
      cloudPayload = { keyword: keyword };
    }

    wx.cloud.callFunction({
      name: 'searchPosts',
      data: cloudPayload,
    })
    .then(res => {
      if (res.result && res.result.code === 0) {
        let posts = res.result.data;

        const processedPosts = posts.map(post => {
          post.timestamp = dayjs(post.createTime).format('YYYY-MM-DD HH:mm');
          const mediaGrid = [];
          if (post.images && post.images.length > 0) {
            post.images.forEach(img => mediaGrid.push({ type: 'image', src: img }));
          }
          post.mediaGrid = mediaGrid.slice(0, 4);
          post.commentCount = post.commentCount || 0;
          post.reactions = post.reactions || [];
          return post;
        });

        this.setData({
          isLoading: false,
          searchResults: processedPosts,
          noResults: processedPosts.length === 0,
        });
      } else {
        throw new Error(res.result.message || 'Search failed');
      }
    })
    .catch(err => {
      console.error('Search cloud function error:', err);
      this.setData({ isLoading: false, noResults: true });
      wx.showToast({ title: '搜索失败，请稍后重试', icon: 'none' });
    });
  },

  handleHistoryTap(e) {
    const { keyword } = e.currentTarget.dataset;
    this.setData({ searchValue: keyword });
    this.executeSearch(keyword);
  },

  handlePopularTap(e) {
    const { keyword } = e.currentTarget.dataset;
    this.setData({ searchValue: keyword });
    this.setHistoryWords(keyword);
    this.executeSearch(keyword);
  },

  setHistoryWords(keyword) {
    const { historyWords } = this.data;
    const index = historyWords.indexOf(keyword);
    if (index !== -1) historyWords.splice(index, 1);
    historyWords.unshift(keyword);
    this.setData({ historyWords });
  },

  handleClearHistory() {
    wx.showModal({
      title: '确认',
      content: '要删除所有历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ historyWords: [] });
        }
      },
    });
  },

  openDetail(e) {
    const id = (e.currentTarget.dataset.post || e.detail)._id;
    if (id) {
      wx.navigateTo({
        url: `/pages/post-detail/index?id=${id}`,
      });
    }
  },
});
