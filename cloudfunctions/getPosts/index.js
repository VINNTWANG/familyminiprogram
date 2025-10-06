// 云函数：getPosts
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-9g6fy6vgc0c01f3d' });
const db = cloud.database();
const _ = db.command;

// 分页拉取动态列表
exports.main = async (event, context) => {
  const { pageSize, lastCreateTime, imageOnly } = event;

  try {
    let query = {};

    if (lastCreateTime) {
      query.createTime = _.lt(new Date(lastCreateTime));
    }

    // If imageOnly is true, add condition to fetch posts that have images.
    if (imageOnly) {
      query.images = _.exists(true).and(_.neq([]));
    }

    const postRes = await db.collection('posts')
      .where(query)
      .orderBy('createTime', 'desc')
      .limit(pageSize || 10)
      .get();

    return postRes.data || [];

  } catch (e) {
    console.error('[getPosts] failed', e);
    return [];
  }
};
