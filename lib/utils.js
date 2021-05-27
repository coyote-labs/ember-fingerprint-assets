/* eslint-env node */

const fs = require('fs');
const path = require('path');
const revHash = require('rev-hash');

const getAllFiles = (dir) => {
  return fs.readdirSync(dir).reduce((files, file) => {
    const name = path.join(dir, file);
    const isDirectory = fs.statSync(name).isDirectory();
    return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
  }, []);
};


const generateHash = (filePath, outputPath, root_url) => {
  let fileContent = fs.readFileSync(filePath);
  let extension = path.extname(filePath)
  let fileName = filePath.replace(extension, '');

  let contentHash = revHash(fileContent);

  let newFileName;

  let chunkRegex = /chunk.[A-z0-9]{20}/g;

  if(chunkRegex.test(fileName)) {
    newFileName = `${fileName.replace(chunkRegex, 'chunk.')}${contentHash}${extension}`;
  } else {
    newFileName = `${fileName}-${contentHash}${extension}`;
  }

  fs.renameSync(filePath, newFileName);

  return newFileName.replace(outputPath, root_url)
};

module.exports = {
  getAllFiles,
  generateHash
};
