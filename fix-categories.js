import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function fixCategories() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const Category = (await import('./model/category.model.js')).default;
    
    console.log('\n🔧 Fixing categories...');
    
    // Define the fixes for each category
    const categoryFixes = [
      {
        bnName: 'এআই',
        enName: 'Artificial Intelligence',
        enSlug: 'artificial-intelligence',
        enDescription: 'Latest developments in AI and machine learning',
        bnDescription: 'কৃত্রিম বুদ্ধিমত্তা এবং মেশিন লার্নিং এর সর্বশেষ অগ্রগতি'
      },
      {
        bnName: 'কিংবদন্তি',
        enName: 'Legends & History',
        enSlug: 'legends-history',
        enDescription: 'Historical figures and legendary stories',
        bnDescription: 'ঐতিহাসিক ব্যক্তিত্ব এবং কিংবদন্তি গল্প'
      },
      {
        bnName: 'লাইফস্টাইল',
        enName: 'Lifestyle',
        enSlug: 'lifestyle',
        enDescription: 'Health, wellness, and lifestyle tips',
        bnDescription: 'স্বাস্থ্য, সুস্থতা এবং জীবনধারার পরামর্শ'
      }
    ];
    
    for (const fix of categoryFixes) {
      const category = await Category.findOne({ 'name.bn': fix.bnName });
      
      if (category) {
        console.log(`\n📝 Updating category: ${fix.bnName} → ${fix.enName}`);
        
        category.name.en = fix.enName;
        category.slug.en = fix.enSlug;
        category.description.en = fix.enDescription;
        category.description.bn = fix.bnDescription;
        
        await category.save();
        console.log(`✅ Updated: ${fix.enName} (${fix.enSlug})`);
      } else {
        console.log(`❌ Category not found: ${fix.bnName}`);
      }
    }
    
    // Show the updated categories
    console.log('\n📊 Updated categories:');
    const categories = await Category.find({}).sort({ createdAt: -1 });
    
    categories.forEach((category, index) => {
      console.log(`\n${index + 1}. ${category.name?.en || 'N/A'} (${category.slug?.en || 'N/A'})`);
      console.log(`   Bangla: ${category.name?.bn || 'N/A'} (${category.slug?.bn || 'N/A'})`);
    });

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixCategories(); 