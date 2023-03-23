module.exports = function (url) {
  this.statusCode = 302;
  this.setHeader("Location", url);
  this.end();
};
