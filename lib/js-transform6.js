/* eslint-env node */
const ASSET_REGEX = /([a-zA-Z0-9\s_\\.\-():])+(\.[a-z]{3})+/g;
const path = require('path');

function replaceStaticAssets(assetMap) {
  return {
    visitor: {
      StringLiteral(paths) {
        const {
          value
        } = paths.node;
        paths.node.value = value.replace(ASSET_REGEX, (match) => {
          let matchedKey = Object.keys(assetMap.assets).filter((key) =>  path.basename(key) === match);
          if(matchedKey.length) {
            return path.basename(assetMap.assets[matchedKey[0]]);
          }
          return match;
        });
      }
    }
  };
}

replaceStaticAssets.baseDir = function () {
  return __dirname;
};

replaceStaticAssets.cacheKey = function () {
  return 'ember-fingerprint-assets';
};

module.exports = replaceStaticAssets;
