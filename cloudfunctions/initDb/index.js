const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
    return `${name}: created`;
  } catch (e) {
    // 已存在或不支持 createCollection 的情况，尝试用 add/remove 触发创建
    if (e && (e.errCode === -502005 || /already exists|exists/i.test(e.message || ''))) {
      return `${name}: exists`;
    }
    try {
      await db.collection(name).add({ data: { __init__: true, __ts__: Date.now() } });
      await db.collection(name).where({ __init__: true }).remove();
      return `${name}: created-by-add`;
    } catch (e2) {
      return `${name}: failed - ${e2.message || e2}`;
    }
  }
}

exports.main = async () => {
  const targets = ['posts', 'comments', 'users', 'verifications', 'families', 'notifications'];
  const results = [];
  for (const t of targets) {
    // 顺序执行，便于定位日志
    // eslint-disable-next-line no-await-in-loop
    results.push(await ensureCollection(t));
  }
  return { code: 0, results };
};
