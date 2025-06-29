import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Connect to MongoDB
await mongoose.connect(process.env.MONGO_URI);
console.log('✅ Connected to MongoDB');

// Import User model
const User = (await import('./model/user.model.js')).default;

async function debugUsers() {
  try {
    console.log('🔍 Checking users in database...');
    
    // Get all users
    const users = await User.find({}).select('-password');
    console.log('\\n📋 All users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - Role: ${user.role}`);
    });
    
    // Try to find the specific user
    const testUser = await User.findOne({ email: 'test@gmail.com' });
    if (testUser) {
      console.log('\\n✅ Found test user:', {
        name: testUser.name,
        email: testUser.email,
        role: testUser.role,
        hasPassword: !!testUser.password
      });
    } else {
      console.log('\\n❌ Test user not found');
    }
    
    // Create a new test user if needed
    console.log('\\n🔧 Creating a new test user...');
    const hashedPassword = await bcrypt.hash('test123', 10);
    const newUser = await User.create({
      name: 'Test User',
      email: 'test2@gmail.com',
      password: hashedPassword,
      role: 'admin',
      language: 'en'
    });
    
    console.log('✅ New test user created:', {
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\\n🔌 Disconnected from MongoDB');
  }
}

debugUsers(); 