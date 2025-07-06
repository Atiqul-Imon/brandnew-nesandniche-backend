import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function resetPassword() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const User = (await import('./model/user.model.js')).default;
  const email = 'imonatikulislam@gmail.com';
  const newPassword = 'admin123';

  const user = await User.findOne({ email });
  if (!user) {
    console.log('❌ User not found:', email);
    await mongoose.disconnect();
    return;
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  console.log(`✅ Password reset for ${email}`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

resetPassword(); 