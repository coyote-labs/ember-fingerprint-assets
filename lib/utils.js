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


const generateHash = (filePath, outputPath) => {
  let fileContent = fs.readFileSync(filePath);
  let extension = path.extname(filePath)
  let fileName = filePath.replace(extension, '');

  let contentHash = revHash(fileContent);

  let newFileName = `${fileName}-${contentHash}${extension}`;

  fs.renameSync(filePath, newFileName);

  return newFileName.replace(outputPath, '')
};

module.exports = {
  getAllFiles,
  generateHash
};
