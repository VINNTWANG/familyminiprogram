// 云函数：getPosts
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-9g6fy6vgc0c01f3d' });
const db = cloud.database();
const _ = db.command;

// 分页拉取动态列表
exports.main = async (event, context) => {
  const { pageSize, lastCreateTime } = event;

  try {
    let query = db.collection('posts').orderBy('createTime', 'desc');

    if (lastCreateTime) {
      query = query.where({
        createTime: _.lt(new Date(lastCreateTime))
      });
    }

    const postRes = await query.limit(pageSize || 10).get();

    return postRes.data || [];

  } catch (e) {
    console.error('[getPosts] failed', e);
    return [];
  }
};
