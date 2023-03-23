module.exports = function ({ req, res, url, route }) {
  if (url.isFilePath) return res.sendFile(url.path.name);

  route("/", () => {
    res.write("root ijfoie");
  });

  route({
    "/1": () => res.write("first route"),
    "/2": () => res.write("second route"),
  });

  route("api/:id", handler);

  return !res.writableEnded && res.end();
};

function handler({ route }) {
  route("inner", ({ res }) => res.write("inner"));
}
