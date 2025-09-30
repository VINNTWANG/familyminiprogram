//云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { keyword, authorId, username } = event;

  if (!keyword && !authorId && !username) {
    return {
      code: -1,
      message: 'At least one search parameter is required.',
      data: [],
    };
  }

  const $ = db.command.aggregate;
  let finalAuthorId = authorId;

  try {
    // If a username is provided, find the authorId first
    if (username) {
      const userRes = await db.collection('users').where({ nickName: username }).get();
      if (userRes.data && userRes.data.length > 0) {
        finalAuthorId = userRes.data[0]._openid;
      } else {
        // User not found, return empty results
        return { code: 0, data: [] };
      }
    }

    const query = {};

    if (keyword) {
      query.content = db.RegExp({
        regexp: keyword,
        options: 'i',
      });
    }

    if (finalAuthorId) {
      query._openid = finalAuthorId;
    }

    console.log('Constructed DB query:', JSON.stringify(query));

    const posts = await db.collection('posts').aggregate()
      .match(query)
      .sort({
        createTime: -1
      })
      .lookup({
        from: 'users',
        localField: '_openid',
        foreignField: '_openid',
        as: 'authorInfo',
      })
      // Convert the authorInfo array to a single object
      .addFields({
        authorInfo: $.arrayElemAt(['$authorInfo', 0])
      })
      .end();

    console.log('DB query result count:', posts.list.length);

    return {
      code: 0,
      data: posts.list,
    };

  } catch (e) {
    console.error('Search aggregate error:', e);
    return {
      code: -2,
      message: 'Search failed.',
      data: [],
    };
  }
};
