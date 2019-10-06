'use strict';

const path = require('path');
const fs = require('fs');
const posthtml = require('posthtml')
const revHash = require('rev-hash');
const babel = require('babel-core');

let tags = [];
let outputPath = '';
let keyMap = {};
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
    keyMap[path.basename(staticAsset)] = path.basename(newFileName);
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

function replaceStaticAssets(parent) {
  const replacer = require('./lib/babel-i18n-transform');
  const replacer6 = require('./lib/babel-i18n-transform6');

  const VersionChecker = require('ember-cli-version-checker');

  let allAssets = getAllFiles(outputPath);
  let jsAssets = allAssets.filter((asset) => {
    return asset.endsWith('.js') &&
      !asset.includes('vendor') &&
      !asset.includes('manifest') &&
      !asset.includes('i18n') &&
      !asset.includes('test');
  });

  let checker = new VersionChecker(parent).for('ember-cli-babel', 'npm');
  let plugins;

  if (checker.satisfies('^5.0.0')) {
    plugins = [replacer];
  } else {
    plugins = [replacer6];
  }

  for (let asset of jsAssets) {
    let assetContents = fs.readFileSync(asset, { encoding: 'utf8' });
    let minified = babel.transform(assetContents, { plugins, minified: true });
    fs.writeFileSync(asset, minified.code, { encoding: 'utf8' });
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
      /*
        TODO: Split into two threads
        One thread: Update index.html
        Another thread: Update static assets.
      */
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

      process.env.keyMap = JSON.stringify(keyMap);

      replaceStaticAssets(this.parent);

      fs.writeFileSync(path.join(outputPath, "assets/assetMap.json"), JSON.stringify(assetMap, null, 2));
    }
  }
};
