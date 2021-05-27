/* eslint-env node */
const ASSET_REGEX = /url\((.*)\)/;
// const FILE_REGEX = /([a-zA-Z0-9\s_\\.\-():])+(\.[a-z]{3})+/g;
const postcss = require('postcss');
const path = require('path');

const replaceStaticAssets = postcss.plugin('postcss-replacer', (outputPath, assetMap) => {
  return (root) => {
    root.walkDecls(/(background|content|border|list-style)/, (decl) => {
      let matched = decl.value.match(ASSET_REGEX);
      if(matched) {
        let fileName = matched[1].replace(/"/g,'');
        let baseFileName = path.basename(fileName);
        let fileNames = Object.keys(assetMap.assets);
        const matchedFileName = fileNames.find(fileName => fileName.endsWith(baseFileName));
        let newFileName = assetMap.assets[matchedFileName];
        if(newFileName){
          decl.value = decl.value.replace(baseFileName, path.basename(newFileName));
        }
      }
    });
  }
})
module.exports = replaceStaticAssets;
