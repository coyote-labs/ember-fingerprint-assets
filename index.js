'use strict';

const path = require('path');
const { getAllFiles, generateHash } = require('./lib/utils');
const fs = require('fs');
const allSettled = require('promise.allsettled');
const posthtml = require('posthtml')
const babel = require('babel-core');
const postcss = require('postcss')

let appEnv;
let root_url;
let outputPath = '';
let assetMap = { "assets": {} };
let reComputeFiles = [];

const processStaticAssets = () => {
  let allAssets = getAllFiles(outputPath);
  let fingerPrintAssets = allAssets.filter((asset) => {
    if(/.*(.js|.css)/.test(asset)) {
      reComputeFiles.push(asset);
      return false;
    }
    return !/.*(.map|.xml|.txt|.html)/.test(asset);
  });
  fingerPrintAssets.forEach((staticAsset) => {
    let newFileName = generateHash(staticAsset, outputPath, root_url);
    assetMap.assets[staticAsset.replace(outputPath, root_url)] = newFileName;
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

const processJSCSS = () => {
  reComputeFiles.forEach((asset) => {
    let newFileName = generateHash(asset, outputPath, root_url);
    assetMap.assets[asset.replace(outputPath, root_url)] = newFileName;
  })
}

const updateHTML = () => {
  return function(tree) {
    let html = tree.find(node => node.tag === 'html');
    let head = html.content.find(node => node.tag === 'head');
    let body = html.content.find(node => node.tag === 'body');

    body.content.forEach(node => {
      if(node && node.attrs && node.attrs.src) {
        let newFileName = assetMap.assets[node.attrs.src]
        if(newFileName) {
          node.attrs.src = newFileName;
        }
      }
    });

    head.content.forEach(node => {
      if(node && node.attrs && node.attrs.href) {
        let newFileName = assetMap.assets[node.attrs.href]
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
    let { rootURL } = app.project.config(app.env);
    root_url = rootURL;
    appEnv = app.env;
  },

  async postBuild(result) {
    if(appEnv === 'production') {
      outputPath = `${result.directory}/`;
      /*
        TODO: Split into two threads
        One thread: Update index.html
        Another thread: Update static assets.
      */
      processStaticAssets();
      await replaceStaticAssetsinCSS();
      replaceStaticAssetsinJS();

      processJSCSS();

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
