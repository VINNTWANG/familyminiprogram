const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) {
    return {
      code: 401,
      message: 'Login function failed to get OPENID.',
    };
  }

  const { nickName, avatarUrl } = event;

  try {
    const usersCollection = db.collection('users');
    const userRecord = await usersCollection.where({ _openid: openid }).get();

    let userData;

    if (userRecord.data.length === 0) {
      // 新用户，创建记录
      const addUserResult = await usersCollection.add({
        data: {
          _openid: openid,
          nickName: nickName,
          avatarUrl: avatarUrl,
          createTime: db.serverDate(),
        }
      });
      // 返回新创建的用户数据
      userData = (await usersCollection.doc(addUserResult._id).get()).data;
    } else {
      // 老用户，更新信息（仅当提供了新信息时）
      const updateData = {};
      if (nickName) {
        updateData.nickName = nickName;
      }
      if (avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }
      if (Object.keys(updateData).length > 0) {
        await usersCollection.doc(userRecord.data[0]._id).update({
          data: updateData
        });
      }
      // 返回更新后的用户数据
      userData = (await usersCollection.doc(userRecord.data[0]._id).get()).data;
    }

    // Add openid to the returned data for debugging purposes
    userData.openid = openid;

    return {
      code: 0,
      message: 'Login successful',
      data: userData,
    };

  } catch (e) {
    console.error(e);
    return {
      code: -1,
      message: 'Login failed',
      error: e,
    };
  }
};