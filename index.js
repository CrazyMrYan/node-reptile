const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const TurndownService = require('turndown');
const turndownService = new TurndownService();
const rules = require('./rules');

const url = 'https://juejin.cn/post/7259356504758779965';

// 创建目录
const docsDir = path.join(__dirname, 'docs');
const imagesDir = path.join(__dirname, 'docs/images');

if(!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir);
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

request(url, async (error, response, body) => {
  if (!error && response.statusCode === 200) {
    // 解析DOM元素
    const $ = cheerio.load(body);
    // 获取文章内容
    const imageElements = $('.markdown-body').find('img');

    const tasks = imageElements.map((index, img) => {
      const imageUrl = $(img).attr('src');
      if(!imageUrl) return Promise.resolve();
      return new Promise((resolve, reject) => {
        request.head(imageUrl, (err, res, body) => {
          // 获取文件扩展名
          const contentType = res.headers['content-type'];
          const extname = contentType ? `.${contentType.split('/')[1]}` : '';
          // 获取文件名
          const filename = path.basename(imageUrl);
          // 创建写入流
          const stream = fs.createWriteStream(path.join(__dirname, 'docs/images', filename + extname));
          // 管道流
          request(imageUrl)
            .pipe(stream)
            .on('close', () => {
              $(img).attr('src', `./images/${filename + extname}`);
              resolve();
            });
        });
      });
    });

    const linkElements = $('.markdown-body').find('a');
    linkElements?.map((index, link) => {
      const url = $(link).attr('href')?.replace('https://link.juejin.cn?target=', '');
      $(link).attr('href', decodeURIComponent(url));
    })

    turndownService.addRule('code', rules.code);
    turndownService.addRule('style', rules.style);

    const filename = $('title').text().replace(' - 掘金', '')?.trim();

    console.log(`文件已生成：${filename}`);

    await Promise.all(tasks)
    const content = $('.markdown-body').html();
    // 转换为markdown
    const markdown = turndownService.turndown(content);
    // 写入文件
    fs.writeFileSync(`docs/${filename}.md`, markdown);
  }
});