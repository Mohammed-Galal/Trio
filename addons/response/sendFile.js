const fs = require("fs"),
  path = require("path"),
  mimeTypes = require("mime-types");

const resolvePath = path.resolve,
  getMimeType = mimeTypes.lookup;

module.exports = function ($path, headers) {
  const RES = this,
    targetPath = resolvePath(RES.appDir, "assets/" + $path),
    mime = getMimeType(path.basename($path));

  fs.readFile(targetPath, function (err, data) {
    if (err) RES.statusCode = 404;
    else {
      const H = headers && headers instanceof Object ? headers : {};
      H["Content-Type"] = mime;
      RES.writeHead(200, H);
      RES.write(data);
    }
    RES.end();
  });
};
