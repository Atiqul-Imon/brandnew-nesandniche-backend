import User from '../model/user.model.js';

export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get fresh user data with permissions
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.hasPermission(permission)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
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