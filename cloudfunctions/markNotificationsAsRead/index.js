
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

// Main function
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return { code: 401, message: 'User not authenticated.' };
  }

  try {
    const res = await db.collection('notifications').where({
      recipientId: openid,
      isRead: false
    }).update({
      data: {
        isRead: true
      }
    });

    return {
      code: 0,
      message: 'Success',
      data: res.stats
    };

  } catch (e) {
    console.error('Failed to mark notifications as read', e);
    return {
      code: 500,
      message: 'Failed to mark notifications as read.',
      error: e.toString(),
    };
  }
};
