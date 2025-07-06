import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkUser() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const User = (await import('./model/user.model.js')).default;
  const email = 'imonatikulislam@gmail.com';
  const password = 'tentetiveThrone123##';

  const user = await User.findOne({ email });
  if (!user) {
    console.log('❌ User not found:', email);
    await mongoose.disconnect();
    return;
  }

  console.log('✅ User found:', {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    hasPassword: !!user.password
  });

  // Test password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  console.log('🔐 Password test:', isPasswordValid ? '✅ Valid' : '❌ Invalid');

  // Show password hash (first 20 chars)
  console.log('🔑 Password hash:', user.password.substring(0, 20) + '...');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

checkUser(); 