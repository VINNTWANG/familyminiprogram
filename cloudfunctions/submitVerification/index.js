// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { note, selfieFileID, inviteCode, type } = event;

  if (!note) {
    return { code: -1, message: 'Note is required.' };
  }

  try {
    // Get user info to store with the application
    const userRes = await db.collection('users').where({ _openid: OPENID }).get();
    const userInfo = userRes.data[0];

    if (!userInfo) {
      return { code: -2, message: 'User not found.' };
    }

    // Create a new verification document
    await db.collection('verifications').add({
      data: {
        _openid: OPENID,
        applicantInfo: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl,
        },
        note: note,
        selfieFileID: selfieFileID || null,
        inviteCode: inviteCode || null,
        status: 'pending', // pending, approved, rejected
        type: type, // 'personal' or 'family'
        createTime: new Date(),
      }
    });

    return { code: 0, message: 'Application submitted successfully.' };

  } catch (e) {
    console.error('Submit verification error', e);
    return { code: -9, message: 'Database error', error: e };
  }
};
