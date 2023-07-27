const url = 'https://juejin.cn/post/7259356504758779965';
const request = require('request');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const fs = require('fs');
const path = require('path');
const urlModule = require('url');
const uuid = require('uuid');

const startElement = '.markdown-body'; // 从.markdown-body元素开始识别Markdown语法

// 创建目录
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

request(url, (error, response, body) => {
  if (!error && response.statusCode === 200) {
    // 解析DOM元素
    const $ = cheerio.load(body);
    const start = $(startElement);
    // 下载图片并替换Markdown中的图片链接
    const images = start.find('img');

    const promises = images?.map((i, image) => {
      let src = $(image).attr('src');
      if (src) {
        let urlObj = urlModule.parse(src);
        if (!urlObj.protocol) {
          urlObj = urlModule.parse(urlModule.resolve(url, src));
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
              request(urlModule.format(urlObj)).pipe(fs.createWriteStream(path.join(__dirname, './docs/images', filename))).on('close', () => {
                $(image).attr('src', `./images/${filename}`);
                resolve();
              }).on('error', reject);
            }
          });
        });
      }
      return null;
    }).get();

    // 将掘金的跳转链接转换为原始链接
    const links = start.find('a');
    links?.map((i, link) => {
      const url = $(link).attr('href').replace('https://link.juejin.cn?target=', '');
      $(link).attr('href', url);
    })

    Promise.all(promises).then(() => {
      const content = start.html();
      // 将HTML转换为Markdown语法
      const turndownService = new TurndownService();

      const markdown = turndownService.turndown(content);

      const filename = $('title').text().replace(' - 掘金', '')?.trim();
      // 生成markdown文件
      const filepath = `./docs/${filename}.md`;
      fs.writeFileSync(filepath, markdown);

      console.log(`文件已生成：${filename}`);
    }).catch((error) => {
      console.error(error);
    });
  }
});