const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const TurndownService = require('turndown');
const turndownService = new TurndownService();
const rules = require('./rules');

const configs = {
	cursor: 0,
	target: 'user',
	userId: '',
	postId: ''
};

// 创建目录
const docsDir = path.join(__dirname, 'docs');
const imagesDir = path.join(__dirname, 'docs/images');

if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir);
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);

// 爬取文章
const handleGrabArticles = async (url, id) => {
	try {
		console.log(`开始抓取文章: ${url}`);
		const body = await new Promise((resolve, reject) => {
			request(url, (error, response, body) => {
				if (error) return reject(error);
				if (response.statusCode !== 200) return reject(new Error(`状态码: ${response.statusCode}`));
				resolve(body);
			});
		});

		// 解析DOM元素
		const $ = cheerio.load(body);
		const content = $('.markdown-body').html();
		if (!content) throw new Error('无法找到文章内容');

		const imageElements = $('.markdown-body').find('img');
		console.log(`找到 ${imageElements.length} 个图片元素`);

		const tasks = imageElements.map((index, img) => {
			const imageUrl = $(img).attr('src');
			if (!imageUrl) return null;

			return new Promise((resolve, reject) => {
				request.head(imageUrl, (err, res) => {
					if (err) return reject(err);

					const contentType = res.headers['content-type'];
					let extname = contentType ? `.${contentType.split('/')[1]}` : '';
					let filename = path.basename(imageUrl).replace(/[^a-zA-Z0-9.-]/g, '_').split('_')[0];

					if (filename.indexOf('.awebp') !== -1) {
						extname = '.webp';
						filename = filename.replace('.awebp', '');
					}

					if (filename.length > 200) filename = filename.substring(0, 200);

					const filePath = path.join(imagesDir, `${filename}${extname}`);
					const stream = fs.createWriteStream(filePath);

					request(imageUrl)
						.pipe(stream)
						.on('finish', () => {
							$(img).attr('src', `./images/${filename}${extname}`);
							resolve();
						})
						.on('error', reject);
				});
			});
		}).get();

		await Promise.all(tasks.filter((task) => task !== null));
		console.log('所有图片下载完成');

		const filename = $('title').text().replace(' - 掘金', '')?.trim();
		console.log(`文章标题: ${filename}`);

		turndownService.addRule('code', rules.code);
		turndownService.addRule('style', rules.style);
		const markdown = turndownService.turndown(content);

		const description = $('meta[name="description"]').attr('content');
		const keywords = $('meta[name="keywords"]').attr('content');
		const datePublished = $('meta[itemprop="datePublished"]').attr('content');
		const tags = keywords?.split(',') ?? [];

		let tagStr = '';
		tags.forEach((tag) => {
			tagStr += `\n  - ${tag}`;
		});

		const contentMarkdown = `---
title: "${filename}"
date: ${datePublished}
tags: ${tagStr}
head:
  - - meta
    - name: headline
      content: ${filename}
  - - meta
    - name: description
      content: ${description}
  - - meta
    - name: keywords
      content: ${keywords}
  - - meta
    - name: datePublished
      content: ${datePublished}
---

${markdown}
`;

		const filePath = path.join(docsDir, `${filename}.md`);
		fs.writeFileSync(filePath, contentMarkdown);
		console.log(`文件已生成：${filename} -> ${filePath}`);
	} catch (error) {
		console.error(`处理文章时出错: ${error}`);
	}
};

const getRequestOptions = () => ({
	url: 'https://api.juejin.cn/content_api/v1/article/query_list',
	body: JSON.stringify({
		cursor: String(configs.cursor),
		sort_type: 2,
		user_id: configs.userId
	}),
	headers: {
		'content-type': 'application/json'
	}
});

const postList = [];

const handleGrabUserArticles = (requestOptions) => {
	request.post(requestOptions, (error, response, body) => {
		if (error || response.statusCode !== 200) return console.error(`请求用户文章时出错: ${error || response.statusCode}`);

		const { data = [], has_more, cursor } = JSON.parse(body);
		if (data?.length) postList.push(...data.map((article) => article.article_id));

		if (has_more) {
			configs.cursor = cursor;
			handleGrabUserArticles(getRequestOptions());
		} else {
			postList.forEach((id) => handleGrabArticles(`https://juejin.cn/post/${id}`, id));
		}
	});
};

const main = async () => {
	const { model: target } = await inquirer.prompt({
		type: 'list',
		name: 'model',
		message: '请选择爬取目标方式',
		choices: [
			{ name: '通过用户 ID 爬取', value: 'user' },
			{ name: '通过文章 ID 爬取', value: 'post' }
		],
		default: configs.target
	});

	configs.target = target;

	if (configs.target === 'user') {
		const { prompt: userId } = await inquirer.prompt({
			type: 'input',
			name: 'prompt',
			message: '请输入用户 ID'
		});
		configs.userId = userId?.trim();
		handleGrabUserArticles(getRequestOptions());
	} else {
		const { prompt: postId } = await inquirer.prompt({
			type: 'input',
			name: 'prompt',
			message: '请输入文章 ID'
		});
		configs.postId = postId?.trim();
		await handleGrabArticles(`https://juejin.cn/post/${configs.postId}`, configs.postId);
		console.log('程序执行完毕');
	}
};

main().catch((error) => console.error('程序执行出错:', error));
