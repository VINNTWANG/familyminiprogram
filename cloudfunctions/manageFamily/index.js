const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// This cloud function is responsible for managing families.
// It's designed to be called by an admin.
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, names } = event;

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
    // Syncs a list of family names with the database, creating any that don't exist.
    case 'sync': {
      if (!names || !Array.isArray(names)) {
        return { code: -3, message: 'An array of family names is required.' };
      }

      try {
        let createdCount = 0;
        let existingCount = 0;

        for (const name of names) {
          const familyRes = await db.collection('families').where({ name: name }).get();
          if (familyRes.data.length === 0) {
            // Family does not exist, create it
            await db.collection('families').add({
              data: {
                name: name,
                createTime: new Date(),
                creator: OPENID, // The admin who triggered the sync
                members: [] // Initially empty
              }
            });
            createdCount++;
          } else {
            existingCount++;
          }
        }
        return { code: 0, message: `Sync complete. ${createdCount} families created, ${existingCount} already existed.` };
      } catch (e) {
        console.error('Family sync error', e);
        return { code: -4, message: 'Sync action failed.', error: e };
      }
    }

    default:
      return { code: -99, message: 'Unknown action.' };
  }
};
