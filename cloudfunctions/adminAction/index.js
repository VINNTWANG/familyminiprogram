// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, verificationId, targetUserId } = event;

  // --- 1. Security Check: Ensure caller is an admin ---
  try {
    const adminRes = await db.collection('users').where({ _openid: OPENID }).get();
    const adminUser = adminRes.data[0];
    if (!adminUser || !adminUser.isAdmin) {
      return { code: -1, message: 'Unauthorized: Not an admin.' };
    }
  } catch (e) {
    return { code: -2, message: 'Admin check failed.', error: e };
  }

  // --- 2. Perform Action based on 'action' parameter ---
  switch (action) {
    case 'approveVerification': {
      if (!verificationId) return { code: -3, message: 'Verification ID is required.' };
      try {
        const verificationRes = await db.collection('verifications').doc(verificationId).get();
        const applicantOpenId = verificationRes.data._openid;

        // Update verification status
        await db.collection('verifications').doc(verificationId).update({ data: { status: 'approved' } });

        // Update user's role to '个人认证'
        await db.collection('users').where({ _openid: applicantOpenId }).update({ data: { role: '个人认证' } });
        
        return { code: 0, message: 'Verification approved.' };
      } catch (e) {
        return { code: -4, message: 'Approve action failed.', error: e };
      }
    }

    case 'approveFamilyVerification': {
      if (!verificationId || !event.familyName) return { code: -3, message: 'Verification ID and family name are required.' };
      try {
        const { familyName } = event;
        const verificationRes = await db.collection('verifications').doc(verificationId).get();
        const verificationData = verificationRes.data;
        const applicantOpenId = verificationData._openid;
        const familyRole = verificationData.note; // Get role from the note

        // --- Enforce Single Family Rule ---
        // 1. Check if user is already in a family
        const userRes = await db.collection('users').where({ _openid: applicantOpenId }).get();
        const user = userRes.data[0];

        if (user && user.familyId) {
          // 2. If yes, remove them from the old family's members list
          await db.collection('families').doc(user.familyId).update({
            data: {
              members: db.command.pull(applicantOpenId)
            }
          });
        }

        // --- Find or Create New Family and Add User ---
        const familyRes = await db.collection('families').where({ name: familyName }).get();
        let familyId = null;

        if (familyRes.data.length > 0) {
          // Family exists, get its ID and add user
          familyId = familyRes.data[0]._id;
          await db.collection('families').doc(familyId).update({
            data: {
              members: db.command.addToSet(applicantOpenId)
            }
          });
        } else {
          // Family does not exist, create it with the user as the first member
          const addRes = await db.collection('families').add({
            data: {
              name: familyName,
              createTime: new Date(),
              creator: OPENID, // The admin who approved
              members: [applicantOpenId]
            }
          });
          familyId = addRes._id;
        }

        // Update verification status
        await db.collection('verifications').doc(verificationId).update({ data: { status: 'approved' } });

        // Update user's role and new family info
        await db.collection('users').where({ _openid: applicantOpenId }).update({
          data: {
            role: familyRole,
            familyName: familyName,
            familyId: familyId
          }
        });
        
        return { code: 0, message: 'Family verification approved.' };
      } catch (e) {
        console.error(e)
        return { code: -4, message: 'Approve action failed.', error: e };
      }
    }

    case 'rejectVerification': {
      if (!verificationId) return { code: -3, message: 'Verification ID is required.' };
      try {
        await db.collection('verifications').doc(verificationId).update({ data: { status: 'rejected' } });
        return { code: 0, message: 'Verification rejected.' };
      } catch (e) {
        return { code: -4, message: 'Reject action failed.', error: e };
      }
    }

    case 'getPendingVerifications': {
      try {
        const res = await db.collection('verifications').where({ status: 'pending' }).orderBy('createTime', 'desc').get();
        return { code: 0, data: res.data };
      } catch (e) {
        return { code: -5, message: 'Failed to get pending verifications.', error: e };
      }
    }

    default:
      return { code: -99, message: 'Unknown action.' };
  }
};
