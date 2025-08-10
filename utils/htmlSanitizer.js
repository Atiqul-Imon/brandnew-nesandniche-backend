import sanitizeHtml from 'sanitize-html';

const allowedTags = sanitizeHtml.defaults.allowedTags.concat([
  'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
]);

const allowedAttributes = {
  a: ['href', 'name', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
  '*': ['class']
};

export function sanitizeHtmlContent(html) {
  return sanitizeHtml(html || '', {
    allowedTags,
    allowedAttributes,
    transformTags: {
      a: (tagName, attribs) => {
        const isExternal = attribs.href && !attribs.href.startsWith('/') && !attribs.href.startsWith('#');
        const rel = new Set([...(attribs.rel?.split(' ') || []), 'noopener', 'noreferrer']);
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            target: isExternal ? '_blank' : undefined,
            rel: Array.from(rel).join(' ')
          }
        };
      }
    }
  });
}


