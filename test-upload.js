import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

const API_BASE_URL = 'http://localhost:5000/api';

async function testUpload() {
  try {
    console.log('🔍 Testing image upload...');
    
    // Step 1: Login to get a token
    console.log('\\n📝 Step 1: Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/api/users/login`, {
      email: 'test2@gmail.com',
      password: 'test123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful, token received');
    
    // Step 2: Test upload endpoint
    console.log('\\n📤 Step 2: Testing upload endpoint...');
    
    // Create a simple test image file
    const testImagePath = path.join(process.cwd(), 'test-image.png');
    const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(testImagePath, testImageBuffer);
    
    const formData = new FormData();
    formData.append('image', fs.createReadStream(testImagePath));
    
    const uploadResponse = await axios.post(`${API_BASE_URL}/api/upload/image`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      }
    });
    
    console.log('✅ Upload successful:', uploadResponse.data);
    
    // Clean up
    fs.unlinkSync(testImagePath);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testUpload(); 