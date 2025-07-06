import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function addMoreCategories() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const Category = (await import('./model/category.model.js')).default;
    
    console.log('\n➕ Adding more categories...');
    
    // Define new categories
    const newCategories = [
      {
        name: {
          en: 'Technology',
          bn: 'প্রযুক্তি'
        },
        slug: {
          en: 'technology',
          bn: 'প্রযুক্তি'
        },
        description: {
          en: 'Latest technology news and innovations',
          bn: 'সর্বশেষ প্রযুক্তি সংবাদ এবং উদ্ভাবন'
        },
        color: '#3B82F6',
        icon: '💻',
        isActive: true,
        sortOrder: 1
      },
      {
        name: {
          en: 'Entertainment',
          bn: 'বিনোদন'
        },
        slug: {
          en: 'entertainment',
          bn: 'বিনোদন'
        },
        description: {
          en: 'Movies, music, and entertainment news',
          bn: 'সিনেমা, সঙ্গীত এবং বিনোদন সংবাদ'
        },
        color: '#EC4899',
        icon: '🎬',
        isActive: true,
        sortOrder: 2
      },
      {
        name: {
          en: 'Sports',
          bn: 'খেলাধুলা'
        },
        slug: {
          en: 'sports',
          bn: 'খেলাধুলা'
        },
        description: {
          en: 'Sports news and updates',
          bn: 'খেলাধুলার সংবাদ এবং আপডেট'
        },
        color: '#10B981',
        icon: '⚽',
        isActive: true,
        sortOrder: 3
      },
      {
        name: {
          en: 'Business',
          bn: 'ব্যবসা'
        },
        slug: {
          en: 'business',
          bn: 'ব্যবসা'
        },
        description: {
          en: 'Business and economic news',
          bn: 'ব্যবসা এবং অর্থনৈতিক সংবাদ'
        },
        color: '#F59E0B',
        icon: '💼',
        isActive: true,
        sortOrder: 4
      },
      {
        name: {
          en: 'Health',
          bn: 'স্বাস্থ্য'
        },
        slug: {
          en: 'health',
          bn: 'স্বাস্থ্য'
        },
        description: {
          en: 'Health and wellness news',
          bn: 'স্বাস্থ্য এবং সুস্থতা সংবাদ'
        },
        color: '#EF4444',
        icon: '🏥',
        isActive: true,
        sortOrder: 5
      },
      {
        name: {
          en: 'Education',
          bn: 'শিক্ষা'
        },
        slug: {
          en: 'education',
          bn: 'শিক্ষা'
        },
        description: {
          en: 'Education news and learning resources',
          bn: 'শিক্ষা সংবাদ এবং শিক্ষার সম্পদ'
        },
        color: '#8B5CF6',
        icon: '📚',
        isActive: true,
        sortOrder: 6
      }
    ];
    
    let addedCount = 0;
    for (const categoryData of newCategories) {
      // Check if category already exists
      const existing = await Category.findOne({
        $or: [
          { 'slug.en': categoryData.slug.en },
          { 'slug.bn': categoryData.slug.bn }
        ]
      });
      
      if (existing) {
        console.log(`⚠️  Category already exists: ${categoryData.name.en}`);
      } else {
        const category = new Category(categoryData);
        await category.save();
        console.log(`✅ Added: ${categoryData.name.en} (${categoryData.slug.en})`);
        addedCount++;
      }
    }
    
    console.log(`\n📊 Added ${addedCount} new categories`);
    
    // Show all categories
    console.log('\n📋 All categories:');
    const allCategories = await Category.find({}).sort({ sortOrder: 1, createdAt: -1 });
    
    allCategories.forEach((category, index) => {
      console.log(`${index + 1}. ${category.name?.en || 'N/A'} (${category.slug?.en || 'N/A'})`);
    });

    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addMoreCategories(); 