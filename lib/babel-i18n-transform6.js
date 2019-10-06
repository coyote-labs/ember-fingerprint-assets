/* eslint-env node */
const ASSET_REGEX = /([a-zA-Z0-9\s_\\.\-():])+(\.[a-z]{3})+/g;

function replaceStaticAssets() {
  return {
    visitor: {
      StringLiteral(path) {
        const {
          value
        } = path.node;
        path.node.value = value.replace(ASSET_REGEX, (match) => {
          let keyMap = JSON.parse(process.env.keyMap);
          let matchedKey = Object.keys(keyMap).filter((key) => key === match);
          if(matchedKey.length) {
            return keyMap[match];
          }
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
