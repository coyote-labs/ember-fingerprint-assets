'use strict';

const path = require('path');
const fs = require('fs');
const posthtml = require('posthtml')
const integrityStringForText = require("./lib/crypto");

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
  tags.forEach((tag) => {
    let fileContent = fs.readFileSync(path.join(outputPath,tag.name));
    console.log(integrityStringForText(fileContent));
  });
}

module.exports = {
  name: require('./package').name,


  included: function (app) {
    this.app = app;
  },

  postBuild(result) {
    console.log(this.app.env, 'prd');

    outputPath = result.directory

    const index = fs.readFileSync(path.join(outputPath, "index.html"), {
      encoding: "utf8"
    });

    const html = posthtml()
      .use(extractScript())
      .use(extractStyles())
      .process(index, { sync: true })
      .html

    processTags();
  }
};
