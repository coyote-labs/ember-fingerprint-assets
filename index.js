'use strict';

const path = require('path');
const fs = require('fs');
const posthtml = require('posthtml')
const revHash = require('rev-hash');
let tags = [];
let outputPath = '';
let assetMap = {};
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
      let newFileName = generateHash(path.join(outputPath, tag.name));
      tag.outFileName = newFileName;
      assetMap[tag.name] = newFileName;
      return tag;
    });
  return tree;
  }
}

function generateHash(filePath) {
  let fileContent = fs.readFileSync(filePath);
  let extension = path.extname(filePath)
  let fileName = filePath.replace(extension, '');

  let contentHash = revHash(fileContent);

  let newFileName = `${fileName}-${contentHash}${extension}`;

  fs.renameSync(filePath, newFileName);

  return newFileName.replace(outputPath, '')
}

function processStaticAssets() {
  let allAssets = getAllFiles(outputPath);
  let staticAssets = allAssets.filter((asset) => {
    return !/.*(.js|.css|.map|.xml|.txt|.html)/.test(asset);
  });
  staticAssets.forEach((staticAsset) => {
    let newFileName = generateHash(staticAsset);
    assetMap[staticAsset.replace(outputPath, '')] = newFileName;
  });
}

const getAllFiles = (dir) => {
  return fs.readdirSync(dir).reduce((files, file) => {
    const name = path.join(dir, file);
    const isDirectory = fs.statSync(name).isDirectory();
    return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
  }, []);
};


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
      outputPath = result.directory;

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

      processStaticAssets();

      fs.writeFileSync(path.join(outputPath, "assets/assetMap.json"), JSON.stringify(assetMap, null, 2));
    }
  }
};
