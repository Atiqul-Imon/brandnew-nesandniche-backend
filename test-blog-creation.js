import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

async function testBlogCreation() {
  try {
    console.log('🔍 Testing blog creation...');
    
    // Step 1: Login to get a token
    console.log('\\n📝 Step 1: Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/users/login`, {
      email: 'shorna@gmail.com',
      password: 'test123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful, token received');
    
    // Step 2: Test blog creation with English only
    console.log('\\n📝 Step 2: Testing blog creation with English only...');
    
    const blogData = {
      title: { en: 'Test Blog Post', bn: '' },
      content: { en: 'This is a test blog post content in English only.', bn: '' },
      excerpt: { en: 'This is a test excerpt in English.', bn: '' },
      slug: { en: 'test-blog-post', bn: '' },
      category: { en: 'Technology', bn: '' },
      tags: ['test', 'technology'],
      featuredImage: 'http://localhost:5000/uploads/1751164376524-blogtest3.png',
      status: 'draft',
      readTime: { en: 1, bn: null },
      seoTitle: { en: 'Test Blog Post', bn: '' },
      seoDescription: { en: 'Test blog post description', bn: '' },
      seoKeywords: { en: ['test', 'blog'], bn: [] }
    };
    
    const blogResponse = await axios.post(`${API_BASE_URL}/api/blogs`, blogData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Blog creation successful:', blogResponse.data);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testBlogCreation(); 