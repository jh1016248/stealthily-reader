// 测试编码检测功能
const fs = require('fs');
const path = '/Users/huangjianhong/Documents/work/john/2025/nodejs/puppeteer-demo/books/翁婿乱情【修订版】/翁婿乱情【修订版】.txt';

// 读取文件
const buffer = fs.readFileSync(path);

// 检查BOM
const bytes = Buffer.from(buffer);
console.log('File size:', bytes.length);
console.log('First few bytes:', Array.from(bytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')));

// 检测编码
function detectEncoding(buffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8'

  // 检查UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8'
  }

  // 尝试用UTF-8解码
  try {
    const decoder = new TextDecoder('utf-8', { fatal: false })
    decoder.decode(buffer.slice(0, 1024))
    // 如果成功解码且没有乱码字符，认为是UTF-8
    return 'utf-8'
  } catch {
    // 如果UTF-8解码失败，尝试GBK
    try {
      const gbkDecoder = new TextDecoder('gbk', { fatal: false })
      const sample = gbkDecoder.decode(buffer.slice(0, 1024))
      // 如果GBK解码后文本有意义，返回GBK
      return 'gbk'
    } catch {
      // 如果GBK也失败，返回UTF-8作为默认
      return 'utf-8'
    }
  }
}

const encoding = detectEncoding(buffer);
console.log('Detected encoding:', encoding);

// 尝试解码
try {
  const decoder = encoding === 'gbk' ?
    new TextDecoder('gbk', { fatal: false }) :
    new TextDecoder(encoding, { fatal: false })
  const content = decoder.decode(buffer).trim();

  console.log('\nFirst 100 characters:');
  console.log(content.substring(0, 100));

  // 检查是否包含乱码字符
  const hasInvalidChars = /[�]/.test(content);
  console.log('\nContains invalid UTF-8 characters:', hasInvalidChars);

} catch (e) {
  console.error('Error decoding:', e);
}