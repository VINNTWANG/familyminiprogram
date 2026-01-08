// E:\Users\wntwa\WeChatProjects\miniprogram-1\pages\release\index.js (Corrected)
import config from '../../config';
const MAX_TEXT_LEN = 1500;

Page({
  data: {
    content: '',
    mediaFiles: [],
    isRecording: false,
    currentAudioIndex: -1,
    // composer helpers
    maxTextLen: MAX_TEXT_LEN,
    remainingCount: MAX_TEXT_LEN,
    canSubmit: false,
    isPublishing: false,
    publishingProgress: 0,
    // i18n
    i18n: {
      composeTitle: '发布动态',
      placeholder: '分享新鲜事...',
      voiceLabel: '语音',
      recordStart: '录制语音',
      recordStop: '停止录音',
      hudCancel: '取消',
      hudStop: '完成',
      publish: '发布',
      sec: '秒',
    },
    // recording HUD
    recordingElapsed: 0,
    recordingMax: 60,
    recordingCanceled: false,
    recordingPercent: 0,
    recordingPercentStyle: 'width: 0%;',
  },

  onLoad: function () {
    this.recorder = wx.getRecorderManager();
    this.audioCtx = wx.createInnerAudioContext();
    this.audioCtx.obeyMuteSwitch = false;

    const self = this;
    this.audioCtx.onPlay(function () {
      self.updateAudioStatus(self.data.currentAudioIndex, true);
    });
    this.audioCtx.onStop(function () {
      self.updateAudioStatus(self.data.currentAudioIndex, false);
      self.setData({ currentAudioIndex: -1 });
    });
    this.audioCtx.onEnded(function () {
      self.updateAudioStatus(self.data.currentAudioIndex, false);
      self.setData({ currentAudioIndex: -1 });
    });

    this.recorder.onStop(function (res) {
      const tempFilePath = res.tempFilePath;
      const duration = res.duration;
      const secs = Math.round((duration || 0) / 1000);
      if (self._recordingTick) { clearInterval(self._recordingTick); self._recordingTick = null; }
      if (self.data.recordingCanceled) {
        self.setData({ isRecording: false, recordingElapsed: 0, recordingPercent: 0, recordingCanceled: false, recordingPercentStyle: 'width: 0%;' });
        return;
      }
      const audioFile = {
        url: tempFilePath,
        type: 'audio',
        duration: secs,
        isPlaying: false,
      };
      // Add the new audio file to the list
      const newMediaFiles = self.data.mediaFiles.concat([audioFile]);
      self.setData({
        mediaFiles: newMediaFiles,
        isRecording: false,
        recordingElapsed: 0,
        recordingPercent: 0,
        recordingPercentStyle: 'width: 0%;',
      });
      self._recalcCanSubmit();
    });
    this.recorder.onError(function () {
      self.setData({ isRecording: false });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  onUnload: function () {
    if (this.audioCtx) {
      this.audioCtx.destroy();
    }
    if (this._recordingTick) { clearInterval(this._recordingTick); this._recordingTick = null; }
  },

  updateAudioStatus: function (index, isPlaying) {
    if (index < 0 || index >= this.data.mediaFiles.length) return;
    const key = `mediaFiles[${index}].isPlaying`;
    const payload = {};
    payload[key] = isPlaying;
    this.setData(payload);
  },

  onAudioPreviewTap: function (e) {
    const index = e.currentTarget.dataset.index;
    const file = this.data.mediaFiles[index];
    if (!file || file.type !== 'audio') return;

    if (file.isPlaying) {
      this.audioCtx.stop();
    } else {
      if (this.data.currentAudioIndex !== -1) {
        this.audioCtx.stop();
      }
      this.setData({ currentAudioIndex: index });
      this.audioCtx.src = file.url;
      this.audioCtx.play();
    }
  },

  onBack: function () { wx.navigateBack(); },

  onContentChange: function (e) {
    const val = e.detail.value || '';
    let content = val;
    if (val.length > MAX_TEXT_LEN) {
      content = val.slice(0, MAX_TEXT_LEN);
      wx.showToast({ title: `最多可输入${MAX_TEXT_LEN}字`, icon: 'none' });
    }
    
    const remaining = MAX_TEXT_LEN - content.length;
    this.setData({
      content: content,
      remainingCount: remaining 
    });
    this._recalcCanSubmit();
  },

  onMediaAdd: function (e) {
    const { files } = e.detail;
    const newMediaFiles = files.map(file => ({
      url: file.url,
      type: file.type,
      // For videos, we get the thumbnail from thumbTempFilePath
      cover: file.type === 'video' ? file.thumbTempFilePath : null,
    }));

    const audioFile = this.data.mediaFiles.find(f => f.type === 'audio');
    let allFiles = [...this.data.mediaFiles.filter(f => f.type !== 'audio'), ...newMediaFiles];
    if (audioFile) {
        allFiles.push(audioFile);
    }

    this.setData({ mediaFiles: allFiles });
    this._recalcCanSubmit();
  },

  onMediaRemove: function (e) {
    const fileToRemove = e.detail.file || e.currentTarget.dataset.file;
    if (!fileToRemove) return;

    const newMediaFiles = this.data.mediaFiles.filter(f => f.url !== fileToRemove.url);
    
    this.setData({ mediaFiles: newMediaFiles });
    this._recalcCanSubmit();
  },

  _recalcCanSubmit: function(){
    const hasText = (this.data.content || '').trim().length > 0;
    const hasMedia = (this.data.mediaFiles || []).length > 0;
    const withinLimit = (this.data.remainingCount || 0) >= 0;
    this.setData({ canSubmit: (hasText || hasMedia) && withinLimit && !this.data.isPublishing });
  },

  onRecordTap: function () {
    if (this.data.isRecording) { this.stopRecording(true); return; }
    const existingAudio = this.data.mediaFiles.find(f => f.type === 'audio');
    if (existingAudio) {
        wx.showModal({
            title: '提示',
            content: '只能录制一段语音，是否要覆盖之前的录音？',
            success: (res) => {
                if (res.confirm) {
                    // Remove previous audio and start recording
                    const newMediaFiles = this.data.mediaFiles.filter(f => f.type !== 'audio');
                    this.setData({ mediaFiles: newMediaFiles }, () => {
                        this.startRecording();
                    });
                }
            }
        });
    } else {
        this.startRecording();
    }
  },

  startRecording: function() {
    const options = { duration: 60000, sampleRate: 44100, numberOfChannels: 1, encodeBitRate: 96000, format: 'mp3' };
    this.setData({ isRecording: true, recordingElapsed: 0, recordingPercent: 0, recordingCanceled: false, recordingPercentStyle: 'width: 0%;' });
    
    if (this._recordingTick) { clearInterval(this._recordingTick); }
    const self = this;
    this._recordingTick = setInterval(function(){
      const next = (self.data.recordingElapsed || 0) + 1;
      const max = (self.data.recordingMax || 60);
      const pct = Math.min(100, Math.floor((next / max) * 100));
      if (next >= max) {
        clearInterval(self._recordingTick); self._recordingTick = null;
        self.stopRecording(true); // Automatically stop when max time is reached
      }
      self.setData({
        recordingElapsed: next, 
        recordingPercent: pct,
        recordingPercentStyle: `width: ${pct}%;`
      });
    }, 1000);
    this.recorder.start(options);
  },

  stopRecording: function(keep){
    if (!this.data.isRecording) return;
    this.setData({ recordingCanceled: !keep });
    this.recorder.stop();
  },
  cancelRecording: function(){ this.stopRecording(false); },

  onRelease: async function () {
    if (!this.data.canSubmit || this.data.isPublishing) return;
    this.setData({ isPublishing: true, publishingProgress: 0 });
    this._recalcCanSubmit();

    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none', success: () => { setTimeout(() => { wx.switchTab({ url: '/pages/my/index' }); }, 1500); } });
      this.setData({ isPublishing: false });
      this._recalcCanSubmit();
      return;
    }

    if (!this.data.content.trim() && this.data.mediaFiles.length === 0) {
      wx.showToast({ title: '请填写内容或上传媒体', icon: 'none' });
      this.setData({ isPublishing: false });
      this._recalcCanSubmit();
      return;
    }
    if ((this.data.content || '').length > MAX_TEXT_LEN) {
      wx.showToast({ title: `内容超出${MAX_TEXT_LEN}字限制`, icon: 'none' });
      this.setData({ isPublishing: false });
      this._recalcCanSubmit();
      return;
    }

    wx.showLoading({ title: '发布中...', mask: true });
    try {
      const db = wx.cloud.database();
      const filesToUpload = this.data.mediaFiles || [];
      
      const uploadPromises = [];

      // Create all upload promises first
      filesToUpload.forEach(file => {
        // Upload the main media file
        uploadPromises.push(this.createUploadPromise(file.url, file.type, 'main'));
        // If it's a video with a cover, upload the cover too
        if (file.type === 'video' && file.cover) {
          uploadPromises.push(this.createUploadPromise(file.cover, 'image', 'cover'));
        }
      });

      const totalCount = uploadPromises.length;
      let completedCount = 0;

      // Wrap promises to track progress
      const trackedPromises = uploadPromises.map(p => p.finally(() => {
        completedCount++;
        this.setData({ publishingProgress: Math.round((completedCount / totalCount) * 100) });
      }));

      const results = await Promise.allSettled(trackedPromises);

      const imageCloudPaths = [];
      const videoCloudPaths = [];
      const audioCloudPaths = [];
      const videoCoverCloudPaths = [];
      let failedUploads = 0;

      results.forEach(res => {
        if (res.status === 'fulfilled') {
          const { fileID, fileType, uploadType } = res.value;
          if (uploadType === 'cover') {
            videoCoverCloudPaths.push(fileID);
          } else if (fileType === 'video') {
            videoCloudPaths.push(fileID);
          } else if (fileType === 'audio') {
            audioCloudPaths.push(fileID);
          } else {
            imageCloudPaths.push(fileID);
          }
        } else {
          failedUploads++;
        }
      });
      
      if (failedUploads > 0) {
        wx.showToast({ title: `${failedUploads}个文件上传失败`, icon: 'none' });
      }

      const hasText = this.data.content.trim().length > 0;
      const hasUploadedMedia = (imageCloudPaths.length + videoCloudPaths.length + audioCloudPaths.length) > 0;

      if (hasText || hasUploadedMedia) {
        await db.collection('posts').add({
          data: {
            content: this.data.content,
            images: imageCloudPaths,
            videos: videoCloudPaths,
            audios: audioCloudPaths,
            videoCovers: videoCoverCloudPaths.length > 0 ? videoCoverCloudPaths : (imageCloudPaths.length > 0 ? [imageCloudPaths[0]] : []),
            createTime: db.serverDate(),
            authorInfo: { nickName: userInfo.nickName, avatarUrl: userInfo.avatarUrl, _openid: userInfo._openid },
            reactions: [],
            commentCount: 0,
            reviewStatus: config.contentCheckMode === 'off' ? 'approved' : 'pending',
            visibility: 'public',
          },
        });

        wx.hideLoading();
        wx.showToast({ title: '发布成功', icon: 'success' });
        setTimeout(() => { wx.reLaunch({ url: '/pages/home/index?oper=release' }); }, 1500);
      } else {
        throw new Error('发布内容为空且所有文件上传失败');
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '发布失败', icon: 'error' });
      console.error('[发布动态] 失败', err);
      this.setData({ isPublishing: false });
      this._recalcCanSubmit();
    }
  },

  createUploadPromise(localPath, fileType, uploadType) {
    let dir = 'post_images';
    if (fileType === 'video') dir = 'post_videos';
    else if (fileType === 'audio') dir = 'post_audios';
    else if (uploadType === 'cover') dir = 'video_covers';

    const ext = (localPath.split('.').pop() || 'tmp').replace(/\?.*$/, '');
    const cloudPath = `${dir}/${Date.now()}-${Math.floor(Math.random() * 1000000)}.${ext}`;
    
    return wx.cloud.uploadFile({ cloudPath, filePath: localPath })
      .then(res => ({ ...res, fileType, uploadType }));
  },
});