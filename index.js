const url = 'https://juejin.cn/post/7259356504758779965';
const request = require('request');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');
const sanitizeFilename = require('sanitize-filename');
const uuid = require('uuid');

const startElement = '.markdown-body'; // 从.markdown-body元素开始识别Markdown语法

// 创建目录
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

// 获取网页内容
request(url, (error, response, body) => {
  if (!error && response.statusCode === 200) {
    // 解析DOM元素
    const $ = cheerio.load(body);
    const start = $(startElement);
    const content = start.html();
    console.log($('title'));

    // 下载图片并替换Markdown中的图片链接
    const images = start.find('img');
    const promises = images.map((i, image) => {
      const src = $(image).attr('src');
      if (src) {
        const urlObj = urlModule.parse(src);
        if (!urlObj.protocol) {
          urlObj.protocol = 'http:';
        }
        const options = {
          url: urlModule.format(urlObj),
          method: 'HEAD',
        };
        return new Promise((resolve, reject) => {
          request(options, (error, response) => {
            if (error) {
              reject(error);
            } else {
              const contentType = response.headers['content-type'];
              const extname = contentType ? `.${contentType.split('/')[1]}` : '';
              const filename = `${uuid.v4()}${extname}`;
              request(urlModule.format(urlObj)).pipe(fs.createWriteStream(path.join(__dirname, 'images', filename))).on('close', () => {
                $(image).attr('src', `./images/${filename}`);
                resolve();
              }).on('error', reject);
            }
          });
        });
      }
      return null;
    }).get();

    Promise.all(promises).then(() => {
      // 将HTML转换为Markdown语法
      const turndownService = new TurndownService();
      const markdown = turndownService.turndown(content);

      // 生成markdown文件
      const filename = `${sanitizeFilename(path.basename(urlModule.parse(url).pathname, '.md'))}.md`;
      fs.writeFileSync(filename, markdown);

      console.log(`Markdown文件已生成：${filename}`);
    }).catch((error) => {
      console.error(error);
    });
  }
});
