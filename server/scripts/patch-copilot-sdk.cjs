const fs = require('fs');
const path = require('path');

function patchCopilotSdkImport() {
  let sessionPath;
  try {
    sessionPath = require.resolve('@github/copilot-sdk/dist/session.js');
  } catch {
    return;
  }

  const content = fs.readFileSync(sessionPath, 'utf8');
  const patched = content.replaceAll('"vscode-jsonrpc/node"', '"vscode-jsonrpc/node.js"');

  if (patched !== content) {
    fs.writeFileSync(sessionPath, patched, 'utf8');
    process.stdout.write(`[postinstall] patched ${path.relative(process.cwd(), sessionPath)}\n`);
  }
}

patchCopilotSdkImport();