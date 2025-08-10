import mongoose from 'mongoose';
import SponsoredSubmission from '../model/sponsoredSubmission.model.js';
import Blog from '../model/blog.model.js';
import { asyncHandler, NotFoundError, AuthorizationError, ValidationError } from '../utils/errorHandler.js';
import logger from '../utils/logger.js';
import { generateSlug, generateUniqueSlug } from '../utils/slugGenerator.js';
import { sanitizeHtmlContent } from '../utils/htmlSanitizer.js';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/emailService.js';
import { sponsoredApprovalEmail } from '../utils/emailTemplates.js';
import { URL } from 'url';
import { BLOCKED_COMPETITOR_HOSTS } from '../utils/contentPolicy.js';

// @desc    Submit a sponsored post request
// @route   POST /api/sponsored-posts/submit
// @access  Public
export const submitSponsoredPost = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      client,
      post,
      sponsorship
    } = req.body;

    // Validate required fields
    if (!client?.name || !client?.email || !client?.company || !client?.website || !client?.industry) {
      throw new ValidationError('All client information is required');
    }

    if (!post?.title?.en || !post?.content?.en || !post?.excerpt?.en || !post?.category?.en || !post?.featuredImage) {
      throw new ValidationError('All post content fields are required');
    }

    if (!sponsorship?.budget || sponsorship.budget < 50) {
      throw new ValidationError('Budget must be at least $50');
    }

    // Create sponsored submission (attach owner if logged in)
    const sponsoredSubmission = new SponsoredSubmission({
      owner: req.user?.userId || null,
      client,
      post,
      sponsorship
    });

    await sponsoredSubmission.save();

    logger.info('Sponsored post submitted', {
      clientEmail: client.email,
      company: client.company,
      budget: sponsorship.budget,
      submissionId: sponsoredSubmission._id
    });

    res.status(201).json({
      success: true,
      message: 'Sponsored post request submitted successfully. We will review and get back to you within 24-48 hours.',
      data: {
        submissionId: sponsoredSubmission._id,
        status: sponsoredSubmission.status,
        estimatedReviewTime: '24-48 hours'
      }
    });

    // Acknowledgment email
    try {
      await sendEmail({
        to: client.email,
        subject: 'Sponsored Post Request Received – News and Niche',
        html: `<p>Hi ${client.name},</p><p>We received your sponsored post request. Our team will review and respond within 24–48 hours.</p><p>Thank you,<br/>News and Niche</p>`,
        text: `Hi ${client.name},\nWe received your sponsored post request and will respond within 24–48 hours.\nThank you, News and Niche`
      });
    } catch (e) {
      logger.error('Failed to send sponsored submission acknowledgment', { error: e.message, email: client.email });
    }

  } catch (error) {
    logger.error('Error submitting sponsored post', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    throw error;
  }
});

// @desc    Get all sponsored post submissions (Admin)
// @route   GET /api/sponsored-posts
// @access  Private (Admin/Moderator)
export const getAllSponsoredSubmissions = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10, sortBy = 'requestDate', sortOrder = 'desc' } = req.query;
  
  try {
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;
    
    const submissions = await SponsoredSubmission.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedTo', 'name email');

    const total = await SponsoredSubmission.countDocuments(query);

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
    logger.error('Error fetching sponsored submissions', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    throw error;
  }
});

// @desc    Get current user's sponsored submissions
// @route   GET /api/sponsored-posts/my
// @access  Private (Owner)
export const getMySponsoredSubmissions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;
  const ownerId = req.user.userId;

  const [submissions, total] = await Promise.all([
    SponsoredSubmission.find({ owner: ownerId })
      .sort({ requestDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    SponsoredSubmission.countDocuments({ owner: ownerId })
  ]);

  res.status(200).json({
    success: true,
    data: { submissions, total }
  });
});

// @desc    Get sponsored submission by ID
// @route   GET /api/sponsored-posts/:id
// @access  Private (Admin/Moderator)
export const getSponsoredSubmissionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const submission = await SponsoredSubmission.findById(id)
      .populate('assignedTo', 'name email')
      .populate('publishedBlogId', 'title slug status');

    if (!submission) {
      throw new NotFoundError('Sponsored submission not found');
    }

    res.status(200).json({
      success: true,
      data: { submission }
    });

  } catch (error) {
    logger.error('Error fetching sponsored submission', {
      error: error.message,
      submissionId: id
    });
    throw error;
  }
});

// @desc    Update sponsored submission status
// @route   PUT /api/sponsored-posts/:id/status
// @access  Private (Admin/Moderator)
export const updateSponsoredSubmissionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes, rejectionReason, assignedTo } = req.body;
  
  try {
    const submission = await SponsoredSubmission.findById(id);
    if (!submission) {
      throw new NotFoundError('Sponsored submission not found');
    }

    const oldStatus = submission.status;
    submission.status = status;
    
    if (adminNotes) {
      submission.adminNotes = adminNotes;
    }
    
    if (rejectionReason && status === 'rejected') {
      submission.rejectionReason = rejectionReason;
    }
    
    if (assignedTo) {
      submission.assignedTo = assignedTo;
    }

    if (status === 'under_review' && !submission.reviewDate) {
      submission.reviewDate = new Date();
    }

    // Allow content updates from sponsor edit link via token
    if (req.body.content && req.body.content.en) {
      const hdr = req.headers['x-edit-token'];
      if (!hdr && !['admin','moderator'].includes(req.user.role)) {
        throw new AuthorizationError('Edit token required');
      }
      if (hdr) {
        try {
          const decoded = jwt.verify(hdr, process.env.JWT_SECRET);
          if (decoded.type !== 'sponsored_edit' || decoded.sid !== submission._id.toString()) {
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

    logger.info('Sponsored submission status updated', {
      submissionId: id,
      oldStatus,
      newStatus: status,
      updatedBy: req.user.userId,
      adminNotes: adminNotes ? 'provided' : 'not provided'
    });

    res.status(200).json({
      success: true,
      message: `Sponsored submission status updated to ${status}`,
      data: { submission }
    });

  // Notify on approval with edit link
  try {
    if (status === 'approved') {
      const token = jwt.sign({ sid: submission._id, type: 'sponsored_edit' }, process.env.JWT_SECRET, { expiresIn: '3d' });
      const editUrl = `${process.env.FRONTEND_URL}/en/sponsored-post/edit/${submission._id}?token=${token}`;
      const tpl = sponsoredApprovalEmail({ name: submission.client.name, submissionId: submission._id, editUrl });
      await sendEmail({ to: submission.client.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }
  } catch (e) {
    logger.error('Failed to send sponsored approval email', { error: e.message, submissionId: submission._id });
  }

  } catch (error) {
    logger.error('Error updating sponsored submission status', {
      error: error.message,
      submissionId: id,
      newStatus: status
    });
    throw error;
  }
});

// @desc    Publish approved sponsored post
// @route   POST /api/sponsored-posts/:id/publish
// @access  Private (Admin/Moderator)
export const publishSponsoredPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const submission = await SponsoredSubmission.findById(id);
    if (!submission) {
      throw new NotFoundError('Sponsored submission not found');
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
      postType: 'sponsored',
      author: {
        name: submission.client.name,
        email: submission.client.email,
        website: submission.client.website,
        company: submission.client.company
      },
      sponsorship: {
        sponsor: submission.client.company,
        sponsorEmail: submission.client.email,
        sponsorWebsite: submission.client.website,
        sponsorLogo: submission.client.logo,
        sponsorIndustry: submission.client.industry,
        isDisclosed: true,
        disclosureText: submission.sponsorship.disclosureText,
        sponsoredAt: new Date(),
        sponsorshipDuration: submission.sponsorship.duration,
        placement: submission.sponsorship.placement
      },
      seoSafety: {
        isSponsored: true,
        hasDisclosure: true,
        disclosurePosition: 'both',
        nofollowLinks: true,
        competitorLinks: false,
        qualityScore: submission.seoReview.qualityScore || 8
      }
    };

    // Enforce sponsored link policy at publish time: drop competitor links, add rel attributes client-side
    const blockedHosts = BLOCKED_COMPETITOR_HOSTS;
    const rewriteSponsoredLinks = (text) => {
      if (!text || typeof text !== 'string') return text;
      return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, url) => {
        try {
          if (url.startsWith('/') || url.startsWith('#')) return m;
          const u = new URL(url);
          if (blockedHosts.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
            return t; // keep text only
          }
          // add rel/target server-side for defense-in-depth
          return `<a href="${url}" rel="sponsored nofollow noopener noreferrer" target="_blank">${t}</a>`;
        } catch {
          return m;
        }
      });
    };
    blogData.content = {
      en: rewriteSponsoredLinks(blogData.content?.en),
      bn: rewriteSponsoredLinks(blogData.content?.bn)
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

    logger.info('Sponsored post published', {
      submissionId: id,
      blogId: blog._id,
      publishedBy: req.user.userId,
      sponsor: submission.client.company
    });

    res.status(200).json({
      success: true,
      message: 'Sponsored post published successfully',
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
    logger.error('Error publishing sponsored post', {
      error: error.message,
      submissionId: id
    });
    throw error;
  }
});

// @desc    Delete sponsored submission
// @route   DELETE /api/sponsored-posts/:id
// @access  Private (Admin)
export const deleteSponsoredSubmission = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  try {
    const submission = await SponsoredSubmission.findById(id);
    if (!submission) {
      throw new NotFoundError('Sponsored submission not found');
    }

    // Check if already published
    if (submission.status === 'published') {
      throw new ValidationError('Cannot delete published sponsored post');
    }

    await SponsoredSubmission.findByIdAndDelete(id);

    logger.info('Sponsored submission deleted', {
      submissionId: id,
      deletedBy: req.user.userId,
      status: submission.status
    });

    res.status(200).json({
      success: true,
      message: 'Sponsored submission deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting sponsored submission', {
      error: error.message,
      submissionId: id
    });
    throw error;
  }
});

// @desc    Get sponsored post statistics
// @route   GET /api/sponsored-posts/stats/overview
// @access  Private (Admin/Moderator)
export const getSponsoredPostStats = asyncHandler(async (req, res) => {
  try {
    const stats = await SponsoredSubmission.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalBudget: { $sum: '$sponsorship.budget' }
        }
      }
    ]);

    const totalSubmissions = await SponsoredSubmission.countDocuments();
    const totalBudget = await SponsoredSubmission.aggregate([
      { $group: { _id: null, total: { $sum: '$sponsorship.budget' } } }
    ]);

    const monthlyStats = await SponsoredSubmission.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$requestDate' },
            month: { $month: '$requestDate' }
          },
          count: { $sum: 1 },
          totalBudget: { $sum: '$sponsorship.budget' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSubmissions,
        totalBudget: totalBudget[0]?.total || 0,
        statusBreakdown: stats,
        monthlyTrends: monthlyStats
      }
    });

  } catch (error) {
    logger.error('Error fetching sponsored post stats', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
});
