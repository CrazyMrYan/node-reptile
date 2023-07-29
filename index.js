const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const TurndownService = require('turndown');
const turndownService = new TurndownService();
const rules = require('./rules');

// 创建目录
const docsDir = path.join(__dirname, 'docs');
const imagesDir = path.join(__dirname, 'docs/images');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir);
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

const main = (url) => {
  request(url, async (error, response, body) => {
    if (!error && response.statusCode === 200) {
      // 解析DOM元素
      const $ = cheerio.load(body);
      // 获取文章内容
      const imageElements = $('.markdown-body').find('img');

      const tasks = imageElements.map((index, img) => {
        const imageUrl = $(img).attr('src');
        if (!imageUrl) return null

        return new Promise((resolve, reject) => {
          request.head(imageUrl, (err, res, body) => {
            if(err) return null
            // 获取文件扩展名
            const contentType = res?.headers['content-type'];
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

      await Promise.all(tasks);
      const content = $('.markdown-body').html();
      try {
        if(!content) return
        // 转换为markdown
        const markdown = turndownService.turndown(content);
        // 写入文件
        fs.writeFileSync(`docs/${filename}.md`, markdown);
        console.log(`文件已生成：${filename}`);
      } catch (error) {
        console.log(error);
        console.log(`错误文章为${url}`);
      }
    }
  });
}

const pageInfo = {
  cursor: 0,
}

const getRequestOptions = () => ({
  url: 'https://api.juejin.cn/content_api/v1/article/query_list',
  body: JSON.stringify({
    cursor: String(pageInfo.cursor),
    sort_type: 2,
    user_id: '703340610597064'
  }),
  headers: {
    'content-type': 'application/json'
  }
});

const postList = []

const getUserPostApi = (requestOptions) => {
  request.post(requestOptions, (error, response, body) => {
    if(response.statusCode === 200 && body) {
      const { data = [], has_more, cursor } = JSON.parse(body);
      if(has_more && data?.length) {
        pageInfo.cursor = cursor;
        postList.push(...data?.map(article => article.article_id));
        getUserPostApi(getRequestOptions());
      } else {
        postList.forEach(id => main(`https://juejin.cn/post/${id}`));
      }
    }
  })
}

getUserPostApi(getRequestOptions())
