import mongoose from 'mongoose';
import GuestSubmission from '../model/guestSubmission.model.js';
import Blog from '../model/blog.model.js';
import { asyncHandler, NotFoundError, AuthorizationError, ValidationError } from '../utils/errorHandler.js';
import { sendEmail } from '../utils/emailService.js';
import { guestApprovalEmail } from '../utils/emailTemplates.js';
import logger from '../utils/logger.js';
import { generateSlug, generateUniqueSlug } from '../utils/slugGenerator.js';
import { sanitizeHtmlContent } from '../utils/htmlSanitizer.js';
import jwt from 'jsonwebtoken';
import { URL } from 'url';
import { BLOCKED_COMPETITOR_HOSTS } from '../utils/contentPolicy.js';

// @desc    Submit a guest post
// @route   POST /api/guest-posts/submit
// @access  Public
export const submitGuestPost = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      author,
      post,
      submission
    } = req.body;

    // Validate required fields
    if (!author?.name || !author?.email || !author?.bio) {
      throw new ValidationError('Author name, email, and bio are required');
    }

    if (!post?.title?.en || !post?.content?.en || !post?.excerpt?.en || !post?.category?.en || !post?.featuredImage) {
      throw new ValidationError('All post content fields are required');
    }

    // Validate content length
    if (post.content.en.trim().length < 800) {
      throw new ValidationError('Content must be at least 800 characters long');
    }

    // Create guest submission (attach owner if logged in)
    const guestSubmission = new GuestSubmission({
      owner: req.user?.userId || null,
      author,
      post,
      submission
    });

    await guestSubmission.save();

    logger.info('Guest post submitted', {
      authorEmail: author.email,
      authorName: author.name,
      submissionType: submission?.type || 'free',
      submissionId: guestSubmission._id
    });

    res.status(201).json({
      success: true,
      message: 'Guest post submitted successfully. We will review and get back to you within 5-7 business days.',
      data: {
        submissionId: guestSubmission._id,
        status: guestSubmission.status,
        estimatedReviewTime: '5-7 business days'
      }
    });

    // Acknowledgment email
    try {
      await sendEmail({
        to: author.email,
        subject: 'Guest Post Received – News and Niche',
        html: `<p>Hi ${author.name},</p><p>We received your guest post submission. Our editors will review and get back to you within 5–7 business days.</p><p>Thank you,<br/>News and Niche</p>`,
        text: `Hi ${author.name},\nWe received your guest post. We will review and get back to you within 5–7 business days.\nThank you, News and Niche`
      });
    } catch (e) {
      logger.error('Failed to send guest submission acknowledgment', { error: e.message, email: author.email });
    }

  } catch (error) {
    logger.error('Error submitting guest post', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    throw error;
  }
});

// @desc    Get all guest post submissions (Admin)
// @route   GET /api/guest-posts
// @access  Private (Admin/Moderator)
export const getAllGuestSubmissions = asyncHandler(async (req, res) => {
  const { status, type, page = 1, limit = 10, sortBy = 'submissionDate', sortOrder = 'desc' } = req.query;
  
  try {
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (type && type !== 'all') {
      query['submission.type'] = type;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;
    
    const submissions = await GuestSubmission.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedTo', 'name email');

    const total = await GuestSubmission.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        submissions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalSubmissions: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching guest submissions', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    throw error;
  }
});

// @desc    Get current user's guest submissions
// @route   GET /api/guest-posts/my
// @access  Private (Owner)
export const getMyGuestSubmissions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;
  const ownerId = req.user.userId;

  const [submissions, total] = await Promise.all([
    GuestSubmission.find({ owner: ownerId })
      .sort({ submissionDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    GuestSubmission.countDocuments({ owner: ownerId })
  ]);

  res.status(200).json({
    success: true,
    data: { submissions, total }
  });
});

// @desc    Get guest submission by ID
// @route   GET /api/guest-posts/:id
// @access  Private (Admin/Moderator)
export const getGuestSubmissionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const submission = await GuestSubmission.findById(id)
      .populate('assignedTo', 'name email')
      .populate('publishedBlogId', 'title slug status');

    if (!submission) {
      throw new NotFoundError('Guest submission not found');
    }

    res.status(200).json({
      success: true,
      data: { submission }
    });

  } catch (error) {
    logger.error('Error fetching guest submission', {
      error: error.message,
      submissionId: id
    });
    throw error;
  }
});

// @desc    Update guest submission status
// @route   PUT /api/guest-posts/:id/status
// @access  Private (Admin/Moderator)
export const updateGuestSubmissionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes, rejectionReason, revisionNotes, assignedTo } = req.body;
  
  try {
    const submission = await GuestSubmission.findById(id);
    if (!submission) {
      throw new NotFoundError('Guest submission not found');
    }

    const oldStatus = submission.status;
    submission.status = status;
    
    if (adminNotes) {
      submission.adminNotes = adminNotes;
    }
    
    if (rejectionReason && status === 'rejected') {
      submission.rejectionReason = rejectionReason;
    }
    
    if (revisionNotes && status === 'needs_revision') {
      submission.revisionNotes = revisionNotes;
    }
    
    if (assignedTo) {
      submission.assignedTo = assignedTo;
    }

    if (status === 'under_review' && !submission.reviewDate) {
      submission.reviewDate = new Date();
    }

    // Allow content updates from guest edit link via token
    if (req.body.content && req.body.content.en) {
      const hdr = req.headers['x-edit-token'];
      if (!hdr && !['admin','moderator'].includes(req.user.role)) {
        throw new AuthorizationError('Edit token required');
      }
      if (hdr) {
        try {
          const decoded = jwt.verify(hdr, process.env.JWT_SECRET);
          if (decoded.type !== 'guest_edit' || decoded.sid !== submission._id.toString()) {
            throw new Error('Invalid token');
          }
        } catch {
          throw new AuthorizationError('Invalid edit token');
        }
      }
      if (submission.owner && req.user && submission.owner.toString() !== req.user.userId && !['admin','moderator'].includes(req.user.role)) {
        throw new AuthorizationError('Not allowed to edit this submission');
      }
      submission.post.content = submission.post.content || {};
      submission.post.content.en = sanitizeHtmlContent(req.body.content.en);
    }

    await submission.save();

    logger.info('Guest submission status updated', {
      submissionId: id,
      oldStatus,
      newStatus: status,
      updatedBy: req.user.userId,
      adminNotes: adminNotes ? 'provided' : 'not provided'
    });

    res.status(200).json({
      success: true,
      message: `Guest submission status updated to ${status}`,
      data: { submission }
    });

  } catch (error) {
    logger.error('Error updating guest submission status', {
      error: error.message,
      submissionId: id,
      newStatus: status
    });
    throw error;
  }
});

// @desc    Publish approved guest post
// @route   POST /api/guest-posts/:id/publish
// @access  Private (Admin/Moderator)
export const publishGuestPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const submission = await GuestSubmission.findById(id);
    if (!submission) {
      throw new NotFoundError('Guest submission not found');
    }

    if (submission.status !== 'approved') {
      throw new ValidationError('Only approved submissions can be published');
    }

    // Create blog post from submission
    const blogData = {
      title: submission.post.title,
      content: submission.post.content,
      excerpt: submission.post.excerpt,
      category: submission.post.category,
      tags: submission.post.tags,
      featuredImage: submission.post.featuredImage,
      status: 'published',
      postType: 'guest',
      author: {
        name: submission.author.name,
        email: submission.author.email,
        bio: submission.author.bio,
        website: submission.author.website,
        company: submission.author.company,
        social: submission.author.social,
        isVerified: submission.author.isVerified
      },
      guestAuthor: {
        name: submission.author.name,
        email: submission.author.email,
        bio: submission.author.bio,
        website: submission.author.website,
        company: submission.author.company,
        social: submission.author.social,
        isVerified: submission.author.isVerified
      },
      seoSafety: {
        isSponsored: false,
        hasDisclosure: false,
        disclosurePosition: 'none',
        nofollowLinks: false,
        competitorLinks: false,
        qualityScore: submission.seoReview.qualityScore || 8
      }
    };

    // Strip competitor links for guest posts if flagged
    const blockedHosts = BLOCKED_COMPETITOR_HOSTS;
    const rewriteGuestLinks = (text) => {
      if (!text || typeof text !== 'string') return text;
      return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, url) => {
        try {
          if (url.startsWith('/') || url.startsWith('#')) return m;
          const u = new URL(url);
          if (blockedHosts.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
            return t; // keep text only
          }
          return m;
        } catch {
          return m;
        }
      });
    };
    blogData.content = {
      en: rewriteGuestLinks(blogData.content?.en),
      bn: rewriteGuestLinks(blogData.content?.bn)
    };

    // Generate slugs
    if (blogData.title.en) {
      blogData.slug = { en: await generateUniqueSlug(blogData.title.en, 'en') };
    }
    if (blogData.title.bn) {
      blogData.slug = { bn: await generateUniqueSlug(blogData.title.bn, 'bn') };
    }

    const blog = new Blog(blogData);
    await blog.save();

    // Update submission
    submission.status = 'published';
    submission.publishedBlogId = blog._id;
    await submission.save();

    logger.info('Guest post published', {
      submissionId: id,
      blogId: blog._id,
      publishedBy: req.user.userId,
      author: submission.author.name
    });

    res.status(200).json({
      success: true,
      message: 'Guest post published successfully',
      data: {
        blog: {
          id: blog._id,
          title: blog.title,
          slug: blog.slug,
          status: blog.status
        },
        submission: {
          id: submission._id,
          status: submission.status
        }
      }
    });

  } catch (error) {
    logger.error('Error publishing guest post', {
      error: error.message,
      submissionId: id
    });
    throw error;
  }
});

// @desc    Delete guest submission
// @route   DELETE /api/guest-posts/:id
// @access  Private (Admin)
export const deleteGuestSubmission = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const submission = await GuestSubmission.findById(id);
    if (!submission) {
      throw new NotFoundError('Guest submission not found');
    }

    // Check if already published
    if (submission.status === 'published') {
      throw new ValidationError('Cannot delete published guest post');
    }

    await GuestSubmission.findByIdAndDelete(id);

    logger.info('Guest submission deleted', {
      submissionId: id,
      deletedBy: req.user.userId,
      status: submission.status
    });

    res.status(200).json({
      success: true,
      message: 'Guest submission deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting guest submission', {
      error: error.message,
      submissionId: id
    });
    throw error;
  }
});

// @desc    Get guest post statistics
// @route   GET /api/guest-posts/stats/overview
// @access  Private (Admin/Moderator)
export const getGuestPostStats = asyncHandler(async (req, res) => {
  try {
    const stats = await GuestSubmission.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const typeStats = await GuestSubmission.aggregate([
      {
        $group: {
          _id: '$submission.type',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalSubmissions = await GuestSubmission.countDocuments();
    const publishedCount = await GuestSubmission.countDocuments({ status: 'published' });
    const pendingCount = await GuestSubmission.countDocuments({ status: 'pending' });

    const monthlyStats = await GuestSubmission.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$submissionDate' },
            month: { $month: '$submissionDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSubmissions,
        publishedCount,
        pendingCount,
        statusBreakdown: stats,
        typeBreakdown: typeStats,
        monthlyTrends: monthlyStats
      }
    });

  } catch (error) {
    logger.error('Error fetching guest post stats', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
});
