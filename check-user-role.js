import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
await mongoose.connect(process.env.MONGO_URI);
console.log('✅ Connected to MongoDB');

// Import User model
const User = (await import('./model/user.model.js')).default;

async function checkAndFixUserRole() {
  try {
    console.log('🔍 Checking user role...');
    
    // Find the user
    const user = await User.findOne({ email: 'shorna@gmail.com' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('📋 Current user details:');
    console.log('- Name:', user.name);
    console.log('- Email:', user.email);
    console.log('- Role:', user.role);
    console.log('- Permissions:', user.permissions);
    
    // Check if role needs to be updated
    if (user.role !== 'admin') {
      console.log('\\n🔧 Updating user role to admin...');
      user.role = 'admin';
      await user.save();
      console.log('✅ User role updated to admin');
    } else {
      console.log('\\n✅ User already has admin role');
    }
    
    // Check permissions
    const permissions = user.getPermissions();
    console.log('\\n📋 User permissions:', permissions);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\\n🔌 Disconnected from MongoDB');
  }
}

checkAndFixUserRole(); 