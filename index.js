'use strict';

const path = require('path');
const fs = require('fs');
const posthtml = require('posthtml')
const revHash = require('rev-hash');
let tags = [];
let outputPath = '';

function extractScript() {
  return function(tree) {
    let html = tree.find(node => node.tag === 'html');
    let body = html.content.find(node => node.tag === 'body');

    body.content.forEach(node => {
      let isTagMatch = node.tag === "script";

      if (isTagMatch && node.attrs && !node.attrs.src.includes('chunk')) {
        tags.push({
          name: node.attrs && node.attrs.src,
          node
        });
      }
    });

    return tree;
  }
}

function extractStyles() {
  return function(tree) {
    let html = tree.find(node => node.tag === 'html');
    let head = html.content.find(node => node.tag === 'head');

    head.content.forEach(node => {
      let isTagMatch = node.tag === "link";

      if (isTagMatch && node.attrs && node.attrs.href.includes('.css')) {
        tags.push({
          name: node.attrs && node.attrs.href,
          node
        });
      }
    });

    return tree;
  }
}

function processTags() {
  return function(tree) {
    tags = tags.map((tag) => {
      let fileContent = fs.readFileSync(path.join(outputPath,tag.name));
      let contentHash = revHash(fileContent);
      let extension = path.extname(tag.name)
      let fileName = tag.name.replace(extension, '');
      let newFileName = `${fileName}-${contentHash}${extension}`;
      tag.outFileName = newFileName;
      fs.renameSync(path.join(outputPath,tag.name), path.join(outputPath, newFileName));
      return tag;
    });
  return tree;
  }
}

function updateHTML() {
  return function(tree) {
    let html = tree.find(node => node.tag === 'html');
    let head = html.content.find(node => node.tag === 'head');
    let body = html.content.find(node => node.tag === 'body');

    body.content.forEach(node => {
      let matchedTag = tags.filter(tag => tag.node === node);
      if(matchedTag.length) {
        node.attrs.src = matchedTag[0].outFileName;
      }
    });

    head.content.forEach(node => {
      let matchedTag = tags.filter(tag => tag.node === node);
      if(matchedTag.length) {
        node.attrs.href = matchedTag[0].outFileName;
      }
    });

    return tree;
  }
}

module.exports = {
  name: require('./package').name,


  included: function (app) {
    this.app = app;
  },

  postBuild(result) {
    if(this.app.env === 'production') {
      outputPath = result.directory

      const index = fs.readFileSync(path.join(outputPath, "index.html"), {
        encoding: "utf8"
      });

      const html = posthtml()
        .use(extractScript())
        .use(extractStyles())
        .use(processTags())
        .use(updateHTML())
        .process(index, { sync: true })
        .html;

      fs.writeFileSync(path.join(outputPath, "index.html"), html, {
        encoding: "utf8"
      });
    }
  }
};
