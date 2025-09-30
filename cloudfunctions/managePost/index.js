// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-9g6fy6vgc0c01f3d' });
const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, postId } = event;

  if (action === 'create') {
    const { content, images, videos, audios, videoCovers, authorInfo } = event;
    try {
      const postData = {
        _openid: OPENID,
        authorInfo,
        content,
        images: images || [],
        videos: videos || [],
        audios: audios || [],
        videoCovers: videoCovers || [],
        createTime: db.serverDate(),
        commentCount: 0,
        reactions: [],
      };
      const addRes = await db.collection('posts').add({ data: postData });
      return { _id: addRes._id, code: 0 };
    } catch (e) {
      console.error('Create post error', e);
      return { code: -4, message: 'Database error', error: e };
    }
  }

  if (action === 'delete') {
    if (!postId) {
      return { code: -1, message: 'postId is required' };
    }

    try {
      // Fetch the user and the post concurrently
      const [userRes, postRes] = await Promise.all([
        db.collection('users').where({ _openid: OPENID }).get(),
        db.collection('posts').doc(postId).get()
      ]);

      const user = userRes.data[0];
      const post = postRes.data;

      if (!post) {
        return { code: -2, message: 'Post not found' };
      }

      // New Permission Check: Allow deletion if user is the owner OR is an admin
      const isAdmin = user && user.isAdmin;
      if (post._openid !== OPENID && !isAdmin) {
        return { code: -3, message: 'No permission to delete this post' };
      }

      // Perform the deletion
      await db.collection('posts').doc(postId).remove();

      return { code: 0, message: 'Post deleted successfully' };

    } catch (e) {
      console.error('Delete post error', e);
      return { code: -4, message: 'Database error', error: e };
    }
  }

  return { code: -99, message: 'Unknown action' };
};