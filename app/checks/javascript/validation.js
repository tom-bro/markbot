'use strict';

const util = require('util');
const path = require('path');
const linter = require('eslint').linter;
const linterConfig = require(__dirname + '/validation/eslint.json');
const markbotMain = require('electron').remote.require('./app/markbot-main');

const bypass = function (checkGroup, checkId, checkLabel) {
  markbotMain.send('check-group:item-bypass', checkGroup, checkId, checkLabel, ['Skipped because of previous errors']);
};

const check = function (checkGroup, checkId, checkLabel, fileContents, lines, next) {
  let messages = {};
  let errors = [];

  markbotMain.send('check-group:item-computing', checkGroup, checkId);
  messages = linter.verify(fileContents, linterConfig);

  if (messages) {
    messages.forEach(function (item) {
      errors.push(util.format('Line %d: %s', item.line, item.message.replace(/\.$/, '')));
    });
  }

  markbotMain.send('check-group:item-complete', checkGroup, checkId, checkLabel, errors);
  next(errors);
};

module.exports.init = function (group) {
  return (function (g) {
    const checkGroup = g;
    const checkId = 'validation';
    const checkLabel = 'Validation';

    markbotMain.send('check-group:item-new', checkGroup, checkId, checkLabel);

    return {
      check: function (fileContents, lines, next) {
        check(checkGroup, checkId, checkLabel, fileContents, lines, next);
      },
      bypass: function () {
        bypass(checkGroup, checkId, checkLabel);
      }
    };
  }(group));
};
