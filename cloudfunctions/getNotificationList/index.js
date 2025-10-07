
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

// Main function
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { pageSize = 10, pageNum = 1 } = event;

  if (!openid) {
    return { code: 401, message: 'User not authenticated.' };
  }

  try {
    const skip = (pageNum - 1) * pageSize;

    // Aggregate notifications with sender and post info
    const res = await db.collection('notifications').aggregate()
      .match({ recipientId: openid })
      .sort({ createTime: -1 })
      .skip(skip)
      .limit(pageSize)
      .lookup({
        from: 'users',
        localField: 'senderId',
        foreignField: '_openid',
        as: 'senderInfo',
      })
      .lookup({
        from: 'posts',
        localField: 'postId',
        foreignField: '_id',
        as: 'postInfo',
      })
      .project({
        _id: 1,
        type: 1,
        isRead: 1,
        createTime: 1,
        postId: 1,
        sender: { $arrayElemAt: ['$senderInfo', 0] },
        post: { $arrayElemAt: ['$postInfo', 0] },
      })
      .end();

    const list = res.list || [];

    // Fetch temp URLs for avatars if they exist
    const avatarFileIds = list.map(item => item.sender && item.sender.avatarUrl).filter(url => url && url.startsWith('cloud://'));
    if (avatarFileIds.length > 0) {
      const tempUrlRes = await cloud.getTempFileURL({ fileList: [...new Set(avatarFileIds)] });
      const urlMap = tempUrlRes.fileList.reduce((acc, cur) => {
        if (cur.status === 0) acc[cur.fileID] = cur.tempFileURL;
        return acc;
      }, {});
      list.forEach(item => {
        if (item.sender && item.sender.avatarUrl && urlMap[item.sender.avatarUrl]) {
          item.sender.avatarUrl = urlMap[item.sender.avatarUrl];
        }
      });
    }

    return {
      code: 0,
      message: 'Success',
      data: list,
    };

  } catch (e) {
    console.error('Failed to get notification list', e);
    return {
      code: 500,
      message: 'Failed to fetch notification list.',
      error: e.toString(),
    };
  }
};
