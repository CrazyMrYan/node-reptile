module.exports = {
  code: {
    filter(node, options) {
      return (
        node.nodeName === 'PRE' &&
        node.firstChild.nodeName === 'CODE'
      )
    },

    replacement(content, node, options) {
      const repeat = (str, times) => {
        return new Array(times + 1).join(str);
      }

      const className = node.firstChild.getAttribute('class') || '';
      const language = (className.match(/language-(\S+)/) || [null, ''])[1];
      const code = node.firstChild.textContent;

      const fenceChar = options.fence.charAt(0);
      const fenceSize = 3;
      const fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm');

      let match;
      while ((match = fenceInCodeRegex.exec(code))) {
        if (match[0].length >= fenceSize) {
          fenceSize = match[0].length + 1;
        }
      }

      const fence = repeat(fenceChar, fenceSize);

      return (
        '\n\n' + fence + language + '\n' +
        code.replace(/\n$/, '').replace('复制代码', '')+
        '\n' + fence + '\n\n'
      )
    }
  },

  style: {
    filter(node, options) {
      return node.nodeName === 'STYLE'
    },

    replacement(content, node, options) {
      return ''
    }
  }
}