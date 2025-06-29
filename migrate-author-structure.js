import mongoose from 'mongoose';
import Blog from './model/blog.model.js';
import User from './model/user.model.js';
import { config } from './config/db.js';

// Connect to MongoDB
mongoose.connect(config.mongoURI);

const migrateAuthorStructure = async () => {
  try {
    console.log('Starting author structure migration...');
    
    // Find all blogs with old author structure (just ObjectId)
    const blogs = await Blog.find({
      author: { $type: 'objectId' }
    });
    
    console.log(`Found ${blogs.length} blogs with old author structure`);
    
    for (const blog of blogs) {
      try {
        // Get user information
        const user = await User.findById(blog.author);
        
        if (user) {
          // Update to new author structure
          blog.author = {
            user: user._id,
            name: user.name || 'Anonymous',
            email: user.email || null,
            bio: null,
            avatar: null,
            website: null,
            social: {
              twitter: null,
              linkedin: null,
              github: null
            }
          };
          
          await blog.save();
          console.log(`✅ Migrated blog: ${blog.title?.en || blog.title?.bn || blog._id}`);
        } else {
          // User not found, set as anonymous author
          blog.author = {
            user: null,
            name: 'Anonymous',
            email: null,
            bio: null,
            avatar: null,
            website: null,
            social: {
              twitter: null,
              linkedin: null,
              github: null
            }
          };
          
          await blog.save();
          console.log(`⚠️  Migrated blog with missing user: ${blog.title?.en || blog.title?.bn || blog._id}`);
        }
      } catch (error) {
        console.error(`❌ Error migrating blog ${blog._id}:`, error.message);
      }
    }
    
    console.log('✅ Author structure migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.disconnect();
  }
};

// Run migration
migrateAuthorStructure(); 