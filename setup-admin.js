import mongoose from 'mongoose';
import User from './model/user.model.js';
import dotenv from 'dotenv';

dotenv.config();

const setupAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find the first user
    const firstUser = await User.findOne().sort({ createdAt: 1 });
    
    if (!firstUser) {
      console.log('No users found in the database');
      return;
    }

    // Check if user is already admin
    if (firstUser.role === 'admin') {
      console.log(`User ${firstUser.email} is already an admin`);
      return;
    }

    // Update user to admin
    firstUser.role = 'admin';
    await firstUser.save();

    console.log(`Successfully set ${firstUser.email} as admin`);
    console.log('User details:', {
      name: firstUser.name,
      email: firstUser.email,
      role: firstUser.role,
      createdAt: firstUser.createdAt
    });

  } catch (error) {
    console.error('Error setting up admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the script
setupAdmin(); 