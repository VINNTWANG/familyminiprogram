const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 文本与媒体内容安全校验
// 入参：{ text?: string, fileIDs?: string[], openid?: string }
exports.main = async (event) => {
  const { text = '', fileIDs = [], openid = '' } = event || {};
  const result = { code: 0, textPass: true, media: [], textDetails: [] };

  try {
    // 文本逐段校验（按 450 字一段，避免超长/误判）
    if (text && typeof text === 'string') {
      const normalized = String(text)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[\t\r]+/g, ' ')
        .trim();
      const segments = [];
      const step = 450;
      for (let i = 0; i < normalized.length; i += step) segments.push(normalized.slice(i, i + step));
      for (const seg of segments) {
        try {
          const r = await cloud.openapi.security.msgSecCheck({
            content: seg,
            version: 2,
            scene: 2,
            openid,
          });
          result.textDetails.push({ ok: true, segLen: seg.length, trace: r && r.trace_id });
        } catch (e) {
          const msg = e && (e.message || e.errMsg || e.toString()) || '';
          const isViolation = /87014/.test(msg) || /sensitive/i.test(msg);
          result.textDetails.push({ ok: !isViolation, error: msg });
          if (isViolation) { result.textPass = false; result.code = result.code || -10; result.textError = msg; break; }
        }
      }
    }

    // 媒体校验（将 fileID 转临时 URL 再校验）
    if (Array.isArray(fileIDs) && fileIDs.length > 0) {
      const { fileList } = await cloud.getTempFileURL({ fileList: fileIDs });
      const urls = (fileList || [])
        .map((f) => f && f.tempFileURL)
        .filter(Boolean);

      for (const u of urls) {
        try {
          const isVideo = /\.(mp4|mov|avi|mkv|flv|m4v|3gp|wmv)(\?|$)/i.test(u);
          const isAudio = /\.(mp3|aac|wav|flac|m4a|ogg)(\?|$)/i.test(u);
          const r = await cloud.openapi.security.mediaCheckAsync({
            media_url: u,
            media_type: (isVideo || isAudio) ? 1 : 2, // 1-音视频 2-图片
            version: 2,
            scene: 2,
          });
          result.media.push({ url: u, pass: true, trace: r && r.trace_id });
        } catch (e) {
          result.media.push({ url: u, pass: false, error: e && (e.message || e.errMsg || e.toString()) });
          result.code = result.code || -11;
        }
      }
    }

    return result;
  } catch (e) {
    return { code: -1, message: e.message || e.toString() };
  }
};

