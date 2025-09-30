const db = wx.cloud.database();

Page({
  data: {
    banners: [],
  },

  onShow() {
    this.fetchBanners();
  },

  fetchBanners() {
    wx.showLoading({ title: '加载中...' });
    db.collection('banners').orderBy('createTime', 'desc').get()
      .then(res => {
        const banners = res.data;
        if (!banners.length) {
          this.setData({ banners: [] });
          wx.hideLoading();
          return;
        }
        // Get temporary URLs for all file IDs
        const fileList = banners.map(banner => banner.fileId);
        wx.cloud.getTempFileURL({ fileList })
          .then(urlRes => {
            const urlMap = {};
            urlRes.fileList.forEach(item => {
              urlMap[item.fileID] = item.tempFileURL;
            });
            const enrichedBanners = banners.map(banner => ({
              ...banner,
              imageUrl: urlMap[banner.fileId]
            }));
            this.setData({ banners: enrichedBanners });
            wx.hideLoading();
          })
          .catch(err => {
            console.error('Failed to get temp URLs', err);
            wx.hideLoading();
            wx.showToast({ title: '图片链接获取失败', icon: 'none' });
          });
      })
      .catch(err => {
        console.error('Failed to fetch banners', err);
        wx.hideLoading();
        wx.showToast({ title: '数据加载失败', icon: 'none' });
      });
  },

  onUpload() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '上传中...' });

        const cloudPath = `banner_images/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;

        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
        })
        .then(uploadRes => {
          const fileId = uploadRes.fileID;
          // Add to database
          db.collection('banners').add({
            data: {
              fileId: fileId,
              createTime: db.serverDate(),
            }
          })
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '上传成功' });
            this.fetchBanners(); // Refresh the list
          })
          .catch(dbErr => {
            console.error('Failed to add to database', dbErr);
            wx.hideLoading();
            wx.showToast({ title: '数据库记录失败', icon: 'none' });
          });
        })
        .catch(uploadErr => {
          console.error('Upload failed', uploadErr);
          wx.hideLoading();
          wx.showToast({ title: '上传失败', icon: 'none' });
        });
      },
    });
  },

  onDelete(e) {
    const { id, fileId } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认删除',
      content: '此操作将永久删除该图片，确定吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });

          // 1. Delete from database
          db.collection('banners').doc(id).remove()
            .then(() => {
              // 2. Delete from cloud storage
              wx.cloud.deleteFile({ fileList: [fileId] })
                .then(() => {
                  wx.hideLoading();
                  wx.showToast({ title: '删除成功' });
                  this.fetchBanners(); // Refresh list
                })
                .catch(fileErr => {
                  console.error('Failed to delete file', fileErr);
                  wx.hideLoading();
                  // Even if file deletion fails, we still refresh the list
                  wx.showToast({ title: '文件删除失败', icon: 'none' });
                  this.fetchBanners();
                });
            })
            .catch(dbErr => {
              console.error('Failed to delete from database', dbErr);
              wx.hideLoading();
              wx.showToast({ title: '数据库记录删除失败', icon: 'none' });
            });
        }
      },
    });
  },

  previewImage(e) {
    const { src } = e.currentTarget.dataset;
    if (src) {
      wx.previewImage({ urls: [src] });
    }
  },
});
