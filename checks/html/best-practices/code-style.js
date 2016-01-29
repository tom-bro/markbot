'use strict';

var
  util = require('util'),
  linter = require('htmlcs'),
  htmlcsOptions = require('./htmlcs.json')
;

// Replace the lowercase attr & tag pairing rules to support embedded SVG
linter.addRule(require('./rule-adv-attr-lowercase'));
linter.addRule(require('./rule-adv-tag-pair'));

module.exports.check = function (fileContents) {
  var
    lintResults,
    errors = []
  ;

  lintResults = linter.hint(fileContents, htmlcsOptions)

  if (lintResults.length > 0) {
    lintResults.forEach(function (item) {
      errors.push(util.format('Line %d: %s', item.line, item.message));
    });
  }

  return errors;
};



