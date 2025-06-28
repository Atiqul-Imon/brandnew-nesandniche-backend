import asyncHandler from 'express-async-handler';
import Comment from '../model/comment.model.js';
import Blog from '../model/blog.model.js';
import logger from '../utils/logger.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../utils/errorHandler.js';

// @desc    Get comments for a blog
// @route   GET /api/comments/blog/:blogId
// @access  Public
export const getBlogComments = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { blogId } = req.params;
  const { page = 1, limit = 10, sort = 'newest' } = req.query;

  try {
    // Check if blog exists
    const blog = await Blog.findById(blogId);
    if (!blog) {
      throw new NotFoundError('Blog not found');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    let sortObj = {};
    switch (sort) {
      case 'newest':
        sortObj = { createdAt: -1 };
        break;
      case 'oldest':
        sortObj = { createdAt: 1 };
        break;
      case 'popular':
        sortObj = { likeCount: -1, createdAt: -1 };
        break;
      default:
        sortObj = { createdAt: -1 };
    }

    // Get top-level comments (no parent)
    const comments = await Comment.find({
      blog: blogId,
      parentComment: null,
      isApproved: true,
      isSpam: false
    })
    .populate('author', 'name profileImage')
    .populate({
      path: 'replies',
      match: { isApproved: true, isSpam: false },
      populate: { path: 'author', select: 'name profileImage' },
      options: { sort: { createdAt: 1 } }
    })
    .sort(sortObj)
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Comment.countDocuments({
      blog: blogId,
      parentComment: null,
      isApproved: true,
      isSpam: false
    });

    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'comments', duration, true);

    res.status(200).json({
      success: true,
      data: {
        comments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('find', 'comments', duration, false);
    logger.error('Comments retrieval failed', { error: error.message, blogId });
    throw error;
  }
});

// @desc    Create comment
// @route   POST /api/comments
// @access  Private
export const createComment = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { blogId, content, parentCommentId } = req.body;

  try {
    // Check if blog exists
    const blog = await Blog.findById(blogId);
    if (!blog) {
      throw new NotFoundError('Blog not found');
    }

    // Check if parent comment exists (for replies)
    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        throw new NotFoundError('Parent comment not found');
      }
    }

    const commentData = {
      blog: blogId,
      author: req.user.userId,
      content,
      parentComment: parentCommentId || null,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Auto-approve comments from authenticated users
    if (req.user.role === 'admin' || req.user.role === 'editor') {
      commentData.isApproved = true;
    }

    const comment = await Comment.create(commentData);

    // If this is a reply, add it to parent comment's replies
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { replies: comment._id }
      });
    }

    const populatedComment = await Comment.findById(comment._id)
      .populate('author', 'name profileImage');

    const duration = Date.now() - startTime;
    logger.logDatabase('create', 'comments', duration, true);
    logger.info('Comment created', { commentId: comment._id, userId: req.user.userId, blogId });

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: { comment: populatedComment }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('create', 'comments', duration, false);
    logger.error('Comment creation failed', { error: error.message, userId: req.user?.userId });
    throw error;
  }
});

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private (Owner/Admin)
export const updateComment = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const { content } = req.body;

  try {
    const comment = await Comment.findById(id);
    
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Check if user can edit this comment
    if (comment.author.toString() !== req.user.userId && req.user.role !== 'admin') {
      throw new AuthorizationError('Not authorized to edit this comment');
    }

    const updatedComment = await Comment.findByIdAndUpdate(
      id,
      {
        content,
        isEdited: true,
        editedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate('author', 'name profileImage');

    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'comments', duration, true);
    logger.info('Comment updated', { commentId: id, userId: req.user.userId });

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: { comment: updatedComment }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'comments', duration, false);
    logger.error('Comment update failed', { error: error.message, commentId: id, userId: req.user?.userId });
    throw error;
  }
});

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private (Owner/Admin)
export const deleteComment = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    const comment = await Comment.findById(id);
    
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Check if user can delete this comment
    if (comment.author.toString() !== req.user.userId && req.user.role !== 'admin') {
      throw new AuthorizationError('Not authorized to delete this comment');
    }

    // If this is a reply, remove it from parent comment's replies
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: comment._id }
      });
    }

    await Comment.findByIdAndDelete(id);
    
    const duration = Date.now() - startTime;
    logger.logDatabase('delete', 'comments', duration, true);
    logger.info('Comment deleted', { commentId: id, userId: req.user.userId });

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('delete', 'comments', duration, false);
    logger.error('Comment deletion failed', { error: error.message, commentId: id, userId: req.user?.userId });
    throw error;
  }
});

// @desc    Toggle like on comment
// @route   POST /api/comments/:id/like
// @access  Private
export const toggleLike = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    const comment = await Comment.findById(id);
    
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    await comment.toggleLike(req.user.userId);
    
    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'comments', duration, true);
    logger.info('Comment like toggled', { commentId: id, userId: req.user.userId });

    res.status(200).json({
      success: true,
      message: 'Like toggled successfully',
      data: {
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
        hasLiked: comment.hasLiked(req.user.userId),
        hasDisliked: comment.hasDisliked(req.user.userId)
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'comments', duration, false);
    logger.error('Comment like toggle failed', { error: error.message, commentId: id, userId: req.user?.userId });
    throw error;
  }
});

// @desc    Toggle dislike on comment
// @route   POST /api/comments/:id/dislike
// @access  Private
export const toggleDislike = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    const comment = await Comment.findById(id);
    
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    await comment.toggleDislike(req.user.userId);
    
    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'comments', duration, true);
    logger.info('Comment dislike toggled', { commentId: id, userId: req.user.userId });

    res.status(200).json({
      success: true,
      message: 'Dislike toggled successfully',
      data: {
        likeCount: comment.likeCount,
        dislikeCount: comment.dislikeCount,
        hasLiked: comment.hasLiked(req.user.userId),
        hasDisliked: comment.hasDisliked(req.user.userId)
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.logDatabase('update', 'comments', duration, false);
    logger.error('Comment dislike toggle failed', { error: error.message, commentId: id, userId: req.user?.userId });
    throw error;
  }
}); 