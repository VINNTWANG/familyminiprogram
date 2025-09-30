const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// Main entry point
exports.main = async (event, context) => {
  const { userInfo } = cloud.getWXContext();
  const {
    action,
    postId,
    content,
    parentCommentId,
    replyToUser,
    commentId
  } = event;

  // Create an effective userInfo object, using the debugOpenid as a fallback
  const effectiveUserInfo = { ...userInfo };
  if (!effectiveUserInfo.openId && event.debugOpenid) {
    effectiveUserInfo.openId = event.debugOpenid;
  }

  if (!action) {
    return {
      code: -1,
      message: 'Missing action'
    };
  }

  try {
    switch (action) {
      case 'add':
        return await addComment(effectiveUserInfo, postId, content, parentCommentId, replyToUser);
      case 'delete':
        return await deleteComment(effectiveUserInfo, postId, commentId);
      default:
        return {
          code: -2,
          message: 'Invalid action'
        };
    }
  } catch (e) {
    console.error('Error in manageComment cloud function', e);
    return {
      code: -500,
      message: '云函数内部错误',
      error: e
    };
  }
};

/**
 * Adds a new comment.
 */
async function addComment(userInfo, postId, content, parentCommentId, replyToUser) {
  if (!userInfo || !userInfo.openId) {
    return {
      code: 401,
      message: '用户未登录'
    };
  }
  if (!postId || !content) {
    return {
      code: 400,
      message: '缺少必要参数 (postId, content)'
    };
  }

  const newComment = {
    _openid: userInfo.openId,
    postId: postId,
    content: content,
    parentCommentId: parentCommentId || null,
    replyToUser: replyToUser || null,
    createTime: new Date(),
  };

  const addResult = await db.collection('comments').add({
    data: newComment,
  });

  // Increment the commentCount on the post
  await db.collection('posts').doc(postId).update({
    data: {
      commentCount: _.inc(1)
    }
  });

  return {
    code: 0,
    message: '评论成功',
    data: {
      _id: addResult._id
    }
  };
}

/**
 * Deletes a comment.
 */
async function deleteComment(userInfo, postId, commentId) {
  if (!userInfo || !userInfo.openId) {
    return {
      code: 401,
      message: '用户未登录'
    };
  }
  if (!commentId || !postId) {
    return {
      code: 400,
      message: '缺少必要参数 (commentId, postId)'
    };
  }

  // Get the comment to be deleted and the post it belongs to
  const [commentRes, postRes] = await Promise.all([
    db.collection('comments').doc(commentId).get(),
    db.collection('posts').doc(postId).get()
  ]);

  const comment = commentRes.data;
  const post = postRes.data;

  if (!comment) {
    return {
      code: 404,
      message: '评论不存在'
    };
  }

  // Permission check: either comment owner or post owner can delete
  const isCommentOwner = userInfo.openId === comment._openid;
  const isPostOwner = post && userInfo.openId === post._openid;

  if (!isCommentOwner && !isPostOwner) {
    return {
      code: 403,
      message: '没有权限删除'
    };
  }

  // Find all child comments to delete them recursively
  const allComments = await db.collection('comments').where({
    postId: postId
  }).get();

  const commentsToDelete = new Set([commentId]);
  let searchQueue = [commentId];

  while (searchQueue.length > 0) {
    const parentId = searchQueue.shift();
    for (const c of allComments.data) {
      if (c.parentCommentId === parentId) {
        commentsToDelete.add(c._id);
        searchQueue.push(c._id);
      }
    }
  }
  
  const deleteIds = Array.from(commentsToDelete);

  // Perform the deletion
  await db.collection('comments').where({
    _id: _.in(deleteIds)
  }).remove();

  // Decrement the commentCount on the post
  await db.collection('posts').doc(postId).update({
    data: {
      commentCount: _.inc(-deleteIds.length)
    }
  });

  return {
    code: 0,
    message: '删除成功'
  };
}
