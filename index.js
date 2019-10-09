'use strict';

const path = require('path');
const { getAllFiles, generateHash } = require('./lib/utils');
const fs = require('fs');
const allSettled = require('promise.allsettled');
const posthtml = require('posthtml')
const babel = require('babel-core');
const postcss = require('postcss')

let outputPath = '';
let assetMap = {};
let isEmbroider = false;
let chunkFiles = [];

const processAssets = () => {
  let allAssets = getAllFiles(outputPath);
  let fingerPrintAssets = allAssets.filter((asset) => {
    if(asset.includes('chunk')){
      isEmbroider = true;
      chunkFiles.push(asset);
      return false
    }
    return !/.*(.map|.xml|.txt|.html)/.test(asset);
  });
  fingerPrintAssets.forEach((staticAsset) => {
    let newFileName = generateHash(staticAsset, outputPath);
    assetMap[staticAsset.replace(outputPath, '')] = newFileName;
  });
}

const replaceStaticAssetsinCSS = async () => {
  const replacer6 = require('./lib/css-transform6')(outputPath, assetMap);

  let allAssets = getAllFiles(outputPath);
  let cssAssets = allAssets.filter((asset) => {
    return asset.endsWith('.css') &&
      !asset.includes('vendor') &&
      !asset.includes('manifest') &&
      !asset.includes('i18n') &&
      !asset.includes('test');
  });

  let plugins = [replacer6];
  let processedcss;
  processedcss = cssAssets.map((asset) => {
    let assetContents = fs.readFileSync(asset, { encoding: 'utf8' });
    return postcss(plugins)
      .process(assetContents);
  });
  let results = await allSettled(processedcss);
  results.forEach((result, index) => {
    if(result.status === 'fulfilled') {
      fs.writeFileSync(cssAssets[index], result.value.css)
    }
  });
}

const replaceStaticAssetsinJS = () => {
  const replacer6 = require('./lib/js-transform6')(assetMap);

  let allAssets = getAllFiles(outputPath);
  let jsAssets = allAssets.filter((asset) => {
    return asset.endsWith('.js') &&
      !asset.includes('vendor') &&
      !asset.includes('manifest') &&
      !asset.includes('i18n') &&
      !asset.includes('test');
  });

  let plugins = [replacer6];

  for (let asset of jsAssets) {
    let assetContents = fs.readFileSync(asset, { encoding: 'utf8' });
    let minified = babel.transform(assetContents, { plugins, minified: true });
    fs.writeFileSync(asset, minified.code, { encoding: 'utf8' });
  }
}

const reComputeChunkHash = () => {
  chunkFiles.forEach((chunkFile) => {
    let newFileName = generateHash(chunkFile, outputPath, isEmbroider);
    assetMap[chunkFile.replace(outputPath, '')] = newFileName;
  })
}

const updateHTML = () => {
  return function(tree) {
    let html = tree.find(node => node.tag === 'html');
    let head = html.content.find(node => node.tag === 'head');
    let body = html.content.find(node => node.tag === 'body');

    body.content.forEach(node => {
      if(node && node.attrs && node.attrs.src) {
        let newFileName = assetMap[node.attrs.src]
        if(newFileName) {
          node.attrs.src = newFileName;
        }
      }
    });

    head.content.forEach(node => {
      if(node && node.attrs && node.attrs.href) {
        let newFileName = assetMap[node.attrs.href]
        if(newFileName) {
          node.attrs.href = newFileName;
        }
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

  async postBuild(result) {
    if(this.app.env === 'production') {
      outputPath = result.directory;
      /*
        TODO: Split into two threads
        One thread: Update index.html
        Another thread: Update static assets.
      */
      processAssets();
      await replaceStaticAssetsinCSS();
      replaceStaticAssetsinJS();

      if(isEmbroider) {
        reComputeChunkHash();
      }

      const index = fs.readFileSync(path.join(outputPath, "index.html"), {
        encoding: "utf8"
      });

      const html = posthtml()
        .use(updateHTML())
        .process(index, { sync: true })
        .html;

      fs.writeFileSync(path.join(outputPath, "index.html"), html, {
        encoding: "utf8"
      });

      fs.writeFileSync(path.join(outputPath, "assets/assetMap.json"), JSON.stringify(assetMap, null, 2));
    }
  }
};
