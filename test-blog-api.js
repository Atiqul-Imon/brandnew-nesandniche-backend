import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function testBlogAPI() {
  try {
    console.log('Testing Blog API...\n');

    // Test 1: Get all blogs with pagination
    console.log('1. Testing pagination...');
    const response1 = await axios.get(`${API_BASE}/blogs?page=1&limit=5&lang=en`);
    console.log('Response structure:', JSON.stringify(response1.data, null, 2));
    console.log('Total blogs:', response1.data.data.total);
    console.log('Blogs returned:', response1.data.data.blogs.length);
    console.log('Total pages:', response1.data.data.pagination?.pages);
    console.log('');

    // Test 2: Get published blogs count
    console.log('2. Testing published blogs count...');
    const response2 = await axios.get(`${API_BASE}/blogs?status=published&lang=en&limit=1`);
    console.log('Published blogs total:', response2.data.data.total);
    console.log('');

    // Test 3: Get draft blogs count
    console.log('3. Testing draft blogs count...');
    const response3 = await axios.get(`${API_BASE}/blogs?status=draft&lang=en&limit=1`);
    console.log('Draft blogs total:', response3.data.data.total);
    console.log('');

    // Test 4: Get archived blogs count
    console.log('4. Testing archived blogs count...');
    const response4 = await axios.get(`${API_BASE}/blogs?status=archived&lang=en&limit=1`);
    console.log('Archived blogs total:', response4.data.data.total);
    console.log('');

    // Test 5: Test pagination with different pages
    console.log('5. Testing pagination with different pages...');
    const response5 = await axios.get(`${API_BASE}/blogs?page=2&limit=3&lang=en`);
    console.log('Page 2 - Total blogs:', response5.data.data.total);
    console.log('Page 2 - Blogs returned:', response5.data.data.blogs.length);
    console.log('Page 2 - Current page:', response5.data.data.pagination?.page);
    console.log('');

  } catch (error) {
    console.error('Error testing API:', error.response?.data || error.message);
  }
}

testBlogAPI(); 