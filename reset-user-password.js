import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// Helper to check if a string is a bcrypt hash
function isBcryptHash(str) {
  return typeof str === 'string' && str.startsWith('$2b$');
}

async function resetPassword(email, newPassword) {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const User = (await import('./model/user.model.js')).default;
    const userEmail = email;
    const password = newPassword;

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.log('❌ User not found:', userEmail);
      await mongoose.disconnect();
      return;
    }

    // Only assign plain password, let pre-save hook hash it
    if (isBcryptHash(password)) {
      console.log('⚠️  Provided password looks like a hash. Please provide a plain password.');
      await mongoose.disconnect();
      return;
    }

    user.password = password;
    await user.save();
    console.log(`✅ Password reset for ${userEmail}`);
    console.log(`🔑 New password: ${password}`);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (err) {
    console.error('❌ Error during password reset:', err);
    try { await mongoose.disconnect(); } catch {}
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const email = args[0];
const newPassword = args[1];

if (!email || !newPassword) {
  console.log('❌ Please provide an email address and a new password');
  console.log('Usage: node reset-user-password.js <email> <new-password>');
  console.log('Example: node reset-user-password.js admin@example.com mynewpassword123');
  process.exit(1);
}

resetPassword(email, newPassword); 