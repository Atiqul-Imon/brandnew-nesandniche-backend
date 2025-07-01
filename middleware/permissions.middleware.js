import User from '../model/user.model.js';

// Check if user has specific permission
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      const permissions = user.getPermissions();
      
      if (!permissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: ${permission} required`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during permission check'
      });
    }
  };
};

// Check if user has admin role
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};

// Check if user has moderator or admin role
export const requireModerator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Moderator or admin access required'
    });
  }

  next();
};

// Check if user has editor, moderator, or admin role
export const requireEditor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!['admin', 'moderator', 'editor'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Editor, moderator, or admin access required'
    });
  }

  next();
};

// Check if user can manage a specific resource
export const canManageResource = (resourceType) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Admins can manage everything
      if (user.role === 'admin') {
        return next();
      }

      // Moderators can manage most things
      if (user.role === 'moderator') {
        return next();
      }

      // Editors can manage their own content
      if (user.role === 'editor') {
        if (resourceType === 'blog') {
          // Check if user is the author of the blog
          const blogId = req.params.id || req.body.blogId;
          if (blogId) {
            const Blog = (await import('../model/blog.model.js')).default;
            const blog = await Blog.findById(blogId);
            if (blog && blog.author?.user?.toString() === user._id.toString()) {
              return next();
            }
          }
        }
      }

      return res.status(403).json({
        success: false,
        message: `Permission denied: Cannot manage ${resourceType}`
      });

    } catch (error) {
      console.error('Resource management check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during permission check'
      });
    }
  };
};

// Check if user can view admin dashboard
export const canViewAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Only admin, moderator, and editor can view admin dashboard
  if (!['admin', 'moderator', 'editor'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Admin dashboard requires elevated privileges'
    });
  }

  next();
};

// Check if user can manage users
export const canManageUsers = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Only admin and moderator can manage users
  if (!['admin', 'moderator'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: User management requires admin or moderator privileges'
    });
  }

  next();
};

// Check if user can manage roles
export const canManageRoles = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Only admin can manage roles
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Role management requires admin privileges'
    });
  }

  next();
};

// Check if user can manage system settings
export const canManageSystem = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Only admin can manage system settings
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: System management requires admin privileges'
    });
  }

  next();
};

export const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!userRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient role permissions'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Role check failed'
      });
    }
  };
};

export const canEditBlog = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id } = req.params;
    const Blog = (await import('../model/blog.model.js')).default;
    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    if (!req.user.canEditBlog(blog)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this blog'
      });
    }

    req.blog = blog;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};

export const canDeleteBlog = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { id } = req.params;
    const Blog = (await import('../model/blog.model.js')).default;
    const blog = await Blog.findById(id);

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog not found'
      });
    }

    if (!req.user.canDeleteBlog(blog)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this blog'
      });
    }

    req.blog = blog;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
}; 