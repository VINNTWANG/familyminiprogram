
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

// Main function
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      code: 401,
      message: 'User not authenticated.',
      count: 0
    };
  }

  try {
    // Query for unread notifications for the current user
    const countResult = await db.collection('notifications')
      .where({
        recipientId: openid,
        isRead: false
      })
      .count();

    const total = countResult.total || 0;

    return {
      code: 0,
      message: 'Success',
      count: total
    };
  } catch (e) {
    console.error('Failed to get notification count', e);
    return {
      code: 500,
      message: 'Failed to fetch notification count.',
      count: 0
    };
  }
};
