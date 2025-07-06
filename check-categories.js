import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkCategories() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const Category = (await import('./model/category.model.js')).default;
    
    console.log('\n📂 Checking all categories in database...');
    
    const categories = await Category.find({}).sort({ createdAt: -1 });
    
    if (categories.length === 0) {
      console.log('❌ No categories found in database');
    } else {
      console.log(`\n📊 Found ${categories.length} categories:`);
      categories.forEach((category, index) => {
        console.log(`\n${index + 1}. Category ID: ${category._id}`);
        console.log(`   Name (EN): "${category.name?.en || 'N/A'}"`);
        console.log(`   Name (BN): "${category.name?.bn || 'N/A'}"`);
        console.log(`   Slug (EN): "${category.slug?.en || 'N/A'}"`);
        console.log(`   Slug (BN): "${category.slug?.bn || 'N/A'}"`);
        console.log(`   Description (EN): "${category.description?.en || 'N/A'}"`);
        console.log(`   Description (BN): "${category.description?.bn || 'N/A'}"`);
        console.log(`   Is Active: ${category.isActive}`);
        console.log(`   Created: ${category.createdAt}`);
        console.log(`   Updated: ${category.updatedAt}`);
        console.log('   ──────────────────────────────────────────');
      });
    }

    // Also check if there are any blogs using these categories
    const Blog = (await import('./model/blog.model.js')).default;
    console.log('\n🔍 Checking blog usage of categories...');
    
    for (const category of categories) {
      const blogCount = await Blog.countDocuments({
        $or: [
          { 'category.en': category.slug?.en },
          { 'category.bn': category.slug?.bn }
        ]
      });
      console.log(`   "${category.name?.en || 'Untitled'}" (${category.slug?.en || 'no-slug'}): ${blogCount} blogs`);
    }

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkCategories(); 