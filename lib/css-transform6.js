/* eslint-env node */
const ASSET_REGEX = /url\((.*)\)/;
const FILE_REGEX = /([a-zA-Z0-9\s_\\.\-():])+(\.[a-z]{3})+/g;
const postcss = require('postcss');
const path = require('path');

const replaceStaticAssets = postcss.plugin('postcss-replacer', (outputPath, assetMap) => {
  return (root) => {
    root.walkDecls(/(background|content|border|list-style)/, (decl) => {
      let matched = decl.value.match(ASSET_REGEX);
      if(matched) {
        let fileName = matched[1].replace(/"/g,'');
        // let resolvedPath = path.resolve(`./${fileName}`)
        //   .replace(outputPath, '')
        //   .replace('private/', '');
        let newFileName = assetMap[fileName];
        if(newFileName){
          decl.value = decl.value.replace(FILE_REGEX, path.basename(newFileName));
        }
      }
    });
  }
})
module.exports = replaceStaticAssets;
