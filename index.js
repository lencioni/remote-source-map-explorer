#!/usr/bin/env node

const fs = require('fs');
const { URL } = require('url');

const { docopt } = require('docopt');
const request = require('request');
const temp = require('temp');
const open = require('opn');
const sourceMapExplorer = require('source-map-explorer');

const { version } = require('./package.json');

const URL_ARG = '<url.js>';

const doc = `Fetch a remote JavaScript file and its sourcemap, and generate a source-map-explorer visualization

Usage:
  remote-source-map-explorer ${URL_ARG}

Options:
  -h --help  Show this screen.
  --version  Show version.
`;

const args = docopt(doc, { version });
const scriptURL = new URL(args[URL_ARG]);

// Fetch file and source map
function get(uri) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      uri,
      gzip: true,
    };

    request(options, (error, response, body) => {
      if (error) {
        reject(error);
        return;
      }

      if (response.statusCode !== 200) {
        reject(`Request failed.\nStatus code: ${response.statusCode}`);
        return;
      }

      resolve(body);
    });
  });
}

console.log(`Fetching ${scriptURL}...`);

get(scriptURL).then((scriptBody) => {
  // Look for sourceMappingURL
  const lastLine = scriptBody.slice(scriptBody.lastIndexOf('\n') + 1);

  const searchToken = '//# sourceMappingURL=';

  if (!lastLine.startsWith(searchToken)) {
    throw new Error('sourceMappingURL not found');
  }

  const sourceMappingURL = new URL(lastLine.slice(searchToken.length), scriptURL);

  console.log(`Fetching ${sourceMappingURL}...`);
  return get(sourceMappingURL).then((sourceMapBody) => {
    console.log('Generating visualization HTML...');
    const { html } = sourceMapExplorer(
      Buffer.from(scriptBody),
      Buffer.from(sourceMapBody),
      { html: true },
    );

    var tempName = temp.path({ suffix: '.html' });
    fs.writeFileSync(tempName, html);

    console.log('Opening visualization in browser...');
    open(tempName, function(error) {
      if (!error) {
        return;
      }

      throw new Error(`Unable to open web browser. ${tempName}`);
    });
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
}).then(() => {
  console.log('All done, enjoy your visualization!');
  process.exit(0);
});
