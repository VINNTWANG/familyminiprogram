const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { postId, emoji } = event || {};
  const openid = cloud.getWXContext().OPENID;

  if (!postId || !emoji) {
    console.error('[manageReaction] invalid params:', event);
    return { code: -2, message: 'invalid params' };
  }

  try {
    const postRef = db.collection('posts').doc(postId);
    const snap = await postRef.get();
    if (!snap.data) {
      console.error('[manageReaction] post not found:', postId);
      return { code: -3, message: 'post not found' };
    }

    const reactions = Array.isArray(snap.data.reactions) ? snap.data.reactions : [];
    const idx = reactions.findIndex((r) => r.openid === openid);

    if (idx > -1) {
      if (reactions[idx].emoji === emoji) {
        reactions.splice(idx, 1);
      } else {
        reactions[idx].emoji = emoji;
      }
    } else {
      reactions.push({ openid, emoji });
    }

    await postRef.update({ data: { reactions } });

    return { code: 0, data: { ...snap.data, reactions } };
  } catch (e) {
    console.error('[manageReaction] error:', e);
    return { code: -1, message: e.toString() };
  }
};
