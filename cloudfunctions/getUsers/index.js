// 云函数：getUsers
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-9g6fy6vgc0c01f3d' });
const db = cloud.database();
const _ = db.command;

// 根据传入的 openid 列表，安全地获取所有用户的信息
exports.main = async (event, context) => {
  const { userIds } = event;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return [];
  }

  try {
    const usersRes = await db.collection('users').where({
      _openid: _.in(userIds)
    }).get();

    return usersRes.data || [];

  } catch (e) {
    console.error('[getUsers] failed', e);
    return [];
  }
};
