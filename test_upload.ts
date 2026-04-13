import { UploadType, Accept } from 'grt-components';

const BUCKET_NAME = 'guoren-files-test';
const TARGET_DIR = 'agent_input';

async function getUploadSignUrl(objectKey: string): Promise<string | null> {
  const baseUrl = 'https://test-guoren-api.grtcloud.net/jeecg-boot';
  const apiUrl = `${baseUrl}/open/aliyun/oss/v1/temp/url`;
  
  // 从 localStorage 获取 token（浏览器环境）
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('SUPERSONIC_TOKEN') : '';
  const tenantId = typeof localStorage !== 'undefined' ? localStorage.getItem('SUPERSONIC_TENANT_ID') : '';
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || '',
        'x-tenant-id': tenantId || ''
      },
      body: JSON.stringify({
        bucketName: BUCKET_NAME,
        objectKey: objectKey,
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' }
      })
    });
    
    const result = await response.json();
    console.log('签名结果:', JSON.stringify(result, null, 2));
    
    // 支持响应格式: {success: true, result: "https://..."}
    if (result.success && result.result) {
      return result.result;
    }
    return null;
  } catch (error) {
    console.error('获取签名URL失败:', error);
    return null;
  }
}

async function uploadFile(signedUrl: string, fileContent: string): Promise<boolean> {
  try {
    const response = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain'  // 必须与签名时的 Content-Type 一致
      },
      body: fileContent
    });
    
    console.log('上传响应状态:', response.status);
    console.log('上传响应:', response.statusText);
    
    if (response.ok) {
      const fileUrl = signedUrl.split('?')[0];
      console.log('上传成功！文件URL:', fileUrl);
      return true;
    } else {
      const errorText = await response.text();
      console.error('上传失败:', errorText);
      return false;
    }
  } catch (error) {
    console.error('上传请求失败:', error);
    return false;
  }
}

async function testUpload() {
  console.log('=== 测试上传到阿里云 OSS ===');
  console.log('目标桶:', BUCKET_NAME);
  console.log('目标目录:', TARGET_DIR);
  console.log('UploadType:', UploadType);
  console.log('Accept:', Accept);
  
  const testFileName = 'test_upload.txt';
  const objectKey = `${TARGET_DIR}/${testFileName}`;
  const fileContent = 'Hello, this is a test file uploaded from test script';
  
  console.log('\n1. 获取签名URL...');
  const signedUrl = await getUploadSignUrl(objectKey);
  
  if (!signedUrl) {
    console.error('无法获取签名URL，测试失败');
    return;
  }
  
  console.log('签名URL:', signedUrl);
  
  console.log('\n2. 执行上传...');
  const success = await uploadFile(signedUrl, fileContent);
  
  if (success) {
    console.log('\n=== 测试成功 ===');
  } else {
    console.log('\n=== 测试失败 ===');
  }
}

testUpload();