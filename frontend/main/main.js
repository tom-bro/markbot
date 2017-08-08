'use strict';

const os = require('os');
const fs = require('fs');
const electron = require('electron');
const shell = electron.shell;
const markbot = electron.remote.require('./markbot');
const listener = electron.ipcRenderer;
const classify = require('../../app/classify');
const successMessages = require('./success-messages.json');
const robotBeeps = require('./robot-beeps.json');
const $body = document.querySelector('body');
const $dropbox = document.getElementById('dropbox');
const $loader = document.getElementById('app-loader');
const $dependencies = document.getElementById('dependencies');
const $checksWrapper = document.getElementById('checks');
const $messagesWrapper = document.getElementById('message-wrapper');
const $checks = document.getElementById('checks-container');
const $checksLoader = document.getElementById('checks-loader');
const $messages = document.getElementById('messages');
const $messagesPositive = document.getElementById('messages-positive');
const $messagesWarning = document.getElementById('messages-warning');
const $messagesLoader = document.getElementById('messages-loader');
const $messagesLoaderLabel = document.querySelector('.messages-loader-label');
const $messageHeader = document.getElementById('message-header');
const $robotLogo = document.querySelector('.robot-logo');
const $messageHeading = document.querySelector('h2.no-errors');
const $signin = document.getElementById('sign-in');
const $submit = document.getElementById('submit');
const $allGoodCheck = document.getElementById('all-good-check');
const $messageCanvas = document.querySelector('.success-fail-message.with-canvas');
const $messageNoCanvas = document.querySelector('.success-fail-message.no-canvas');

// TOOLBAR
const $toolbar = document.getElementById('toolbar');
const $openEditorBtn = document.getElementById('open-editor');
const $openBrowserBtn = document.getElementById('open-browser');
const $openRepoBtn = document.getElementById('open-repo');
const $createIssueBtn = document.getElementById('create-issue');
const $statusBar = document.getElementById('status-bar');
const $refreshBtn = document.getElementById('refresh-btn');
const $repoName = document.getElementById('folder');
const $canvasBtn = document.getElementById('submit-btn');
const $canvasBtnText = $canvasBtn.querySelector('#button-text');
const $statusBarRed = document.getElementById('status-bar-red');
const $statusBarYellow = document.getElementById('status-bar-yellow');
const $statusBarGreen = document.getElementById('status-bar-green');
const $statusBarRedText = $statusBarRed.querySelector('.toolbar-status-text');
const $statusBarYellowText = $statusBarYellow.querySelector('.toolbar-status-text');
const $statusBarGreenText = $statusBarGreen.querySelector('.toolbar-status-text');

let groups = {};
let checks = {};
let fullPath = false;
let isMarkbotDoneYet;
let appIsReady = false;

const ERROR_MESSAGE_STATUS = require(`${__dirname}/../../app/error-message-status`);

const ERROR_MESSAGE_TYPE = {
  ERROR: '-error',
  WARNING: '-warning',
  MESSAGE: '-message',
};

const appReady = function () {
  appIsReady = true;

  $loader.dataset.state = 'hidden';
  $dependencies.dataset.state = 'hidden';

  if (localStorage.getItem('github-username')) {
    $signin.dataset.state = 'hidden';
    $dropbox.dataset.state = 'visible';
    markbot.enableSignOut(localStorage.getItem('github-username'));
  } else {
    $signin.dataset.state = 'visible';
    $dropbox.dataset.state = 'hidden';
  }
};

const buildCodeDiffErrorMessage = function (err, li) {
  const message = document.createElement('span');
  const code = document.createElement('section');
  const sawDiv = document.createElement('div');
  const expectedDiv = document.createElement('div');
  const sawHead = document.createElement('strong');
  const expectedHead = document.createElement('strong');
  const sawPre = document.createElement('pre');
  const expectedPre = document.createElement('pre');

  message.textContent = err.message;

  code.classList.add('error-code-block');
  sawDiv.classList.add('error-sample-saw');
  expectedDiv.classList.add('error-sample-expected');
  sawHead.textContent = 'Saw in your code:';
  expectedHead.textContent = 'Expected to see:';
  sawHead.classList.add('error-sample-head');
  expectedHead.classList.add('error-sample-head');

  err.code.saw.forEach(function (line, i) {
    let tag = document.createElement('code');

    tag.textContent = line;

    if (i == err.code.line) tag.classList.add('error-sample-line');

    sawPre.innerHTML += tag.outerHTML;
  });

  err.code.expected.forEach(function (line, i) {
    let tag = document.createElement('code');

    tag.textContent = line;

    if (i == err.code.line) tag.classList.add('error-sample-line');

    expectedPre.innerHTML += tag.outerHTML;
  });

  li.appendChild(message);

  sawDiv.appendChild(sawHead);
  sawDiv.appendChild(sawPre);
  expectedDiv.appendChild(expectedHead);
  expectedDiv.appendChild(expectedPre);

  code.appendChild(sawDiv);
  code.appendChild(expectedDiv);

  li.appendChild(code);
};

const displayDiffWindow = function (imgs, width) {
  markbot.showDifferWindow(imgs, width);
};

const buildImageDiffErrorMessage = function (err, li) {
  let message = document.createElement('span');
  let diff = document.createElement('span');
  let div = document.createElement('div');
  let imgWrap = document.createElement('div');
  let img = document.createElement('img');
  let expectedPercent = Math.ceil(err.diff.expectedPercent * 100);
  let percent = Math.ceil(err.diff.percent * 100);

  div.classList.add('diff-wrap');
  div.setAttribute('aria-role', 'button');
  div.setAttribute('tabindex', 0);
  message.textContent = err.message;
  diff.innerHTML = `${percent}% difference<br>Expecting less than ${expectedPercent}%`;
  imgWrap.classList.add('diff-img-wrap');
  img.src = `${err.images.diff}?${Date.now()}`;

  imgWrap.appendChild(img);
  div.appendChild(imgWrap);
  div.appendChild(diff);

  li.appendChild(message);
  li.appendChild(div);

  div.addEventListener('click', function () {
    displayDiffWindow(JSON.stringify(err.images), err.width);
  });

  div.addEventListener('keyup', function (e) {
    if (e.code == 'Enter' || e.code == 'Space') displayDiffWindow(JSON.stringify(err.images), err.width);
  });
};

const buildTableErrorMessage = function (err, li) {
  let table = document.createElement('table');
  let caption = document.createElement('caption');
  let thead = document.createElement('thead');
  let tbody = document.createElement('tbody');
  let theadRow = document.createElement('tr');

  caption.innerHTML = err.message;
  table.appendChild(caption);

  err.headings.forEach(function (item) {
    let th = document.createElement('th');

    th.innerHTML = item;
    th.setAttribute('scope', 'col');
    theadRow.appendChild(th);
  });

  err.rows.forEach(function (item) {
    let tr = document.createElement('tr');
    let th = document.createElement('th');

    th.innerHTML = item.title;
    th.setAttribute('scope', 'row');
    tr.appendChild(th);

    if (item.highlight) tr.classList.add('highlight');

    item.data.forEach(function (data) {
      let td = document.createElement('td');

      td.innerHTML = prepareErrorText(data);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  thead.appendChild(theadRow);
  table.appendChild(thead);
  table.appendChild(tbody);
  li.appendChild(table);
};

const buildErrorMessageFromObject = function (err, li) {
  switch (err.type) {
    case 'code-diff':
      buildCodeDiffErrorMessage(err, li);
      break;
    case 'image-diff':
      buildImageDiffErrorMessage(err, li);
      break;
    case 'table':
      buildTableErrorMessage(err, li);
      break;
  }
};

const escapeHTML = function (err) {
  if (typeof err !== 'string') return err;

  return err.replace(/[&<>]/g, function (tag) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;'
    }[tag];
  });
};

const transformCodeBlocks = function (err) {
  if (typeof err !== 'string') return err;

  while (err.match(/`/)) {
    err = err.replace(/`/, '<samp>');
    err = err.replace(/`/, '</samp>');
  }

  return err;
};

const transformLinks = function (err) {
  if (typeof err !== 'string') return err;

  if (err.match(/@@/)) {
    err = err.replace(/@@(.+?)@@/g, '<a href="$1">$1</a>');
  }

  return err;
};

const transformStrong = function (err) {
  if (typeof err !== 'string') return err;

  if (err.match(/\*\*/)) {
    err = err.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  return err;
};

const transformMark = function (err) {
  if (typeof err !== 'string') return err;

  if (err.match(/\*\*\*/)) {
    err = err.replace(/\*\*\*(.+?)\*\*\*/g, '<mark>$1</mark>');
  }

  return err;
};

const transformUnderline = function (err) {
  if (typeof err !== 'string') return err;

  if (err.match(/\~\~/)) {
    err = err.replace(/\~\~(.+?)\~\~/g, '<u>$1</u>');
  }

  return err;
};


const transformLists = function (err) {
  if (typeof err !== 'string') return err;

  if (err.match(/\-\-\-\+\+\+/)) {
    err = err.replace(/\-\-\-\+\+\+/g, '<ul><li>').replace(/\+\+\+/g, '</li><li>').replace(/\-\-\-/g, '</li></ul>');
  }

  return err;
}

const prepareErrorText = function (err) {
  const transformations = [
    escapeHTML,
    transformLinks,
    transformMark,
    transformStrong,
    transformUnderline,
    transformLists,
    transformCodeBlocks,
  ];

  transformations.forEach((func) => {
    err = func(err);
  });

  return err;
};

const buildErrorMessageList = function (errors) {
  const $errorList = document.createElement('ul');

  errors.forEach(function (err) {
    const li = document.createElement('li');

    if (typeof err == 'object') {
      buildErrorMessageFromObject(err, li);

      if (err.status) status = err.status;
    } else {
      li.innerHTML = prepareErrorText(err);
    }

    $errorList.appendChild(li)
  });

  return $errorList;
};

const buildErrorMessageGroup = function (group, label, linkId, $errorList, status) {
  const $errorGroup = document.createElement('div');
  const $groupHead = document.createElement('h2');
  const $groupHeadText = document.createElement('span');

  $groupHead.id = linkId;
  $groupHead.setAttribute('tabindex', 0);
  $groupHeadText.textContent = groups[group].label + ' — ' + label;
  $groupHead.appendChild($groupHeadText);

  switch (status) {
    case ERROR_MESSAGE_STATUS.BYPASS:
      $errorGroup.dataset.state = 'bypassed';
      break;
    case ERROR_MESSAGE_STATUS.SKIP:
      let skipLi = document.createElement('li');
      skipLi.textContent = 'More checks skipped because of the above errors';
      skipLi.dataset.state = 'skipped';
      $errorList.appendChild(skipLi)
      break;
    default:
      break;
  }

  $errorGroup.appendChild($groupHead);
  $errorGroup.appendChild($errorList);

  return $errorGroup;
};

const displayErrors = function (group, label, linkId, errors, messages, warnings, status) {
  const hasErrors = (errors && errors.length > 0);
  const hasWarnings = (warnings && warnings.length > 0);
  const hasMessages = (messages && messages.length > 0);

  if (hasMessages) {
    $messagesPositive.appendChild(buildErrorMessageGroup(group, label, linkId + ERROR_MESSAGE_TYPE.MESSAGE, buildErrorMessageList(messages), status));
    $messagesPositive.dataset.state = 'visible';
  }

  if (hasWarnings) {
    $messagesWarning.appendChild(buildErrorMessageGroup(group, label, linkId + ERROR_MESSAGE_TYPE.WARNING, buildErrorMessageList(warnings), status));
    $messagesWarning.dataset.state = 'visible';
  }

  if (hasErrors) {
    $messages.appendChild(buildErrorMessageGroup(group, label, linkId + ERROR_MESSAGE_TYPE.ERROR, buildErrorMessageList(errors), status));
    $messages.dataset.state = 'visible';
  }
};

const reset = function () {
  clearInterval(isMarkbotDoneYet);
  $messages.innerHTML = '';
  $messagesPositive.innerHTML = '';
  $messagesWarning.innerHTML = '';
  $checks.innerHTML = '';
  $checksLoader.dataset.state = 'visible';
  $messagesLoader.dataset.state = 'visible';
  $messagesLoaderLabel.innerHTML = robotBeeps[Math.floor(Math.random() * robotBeeps.length)] + '…';
  $messages.dataset.state = 'hidden';
  $messagesPositive.dataset.state = 'hidden';
  $messagesWarning.dataset.state = 'hidden';
  $messageHeader.dataset.state = 'computing';
  $robotLogo.setAttribute('aria-label', 'Computing…');
  $submit.dataset.state = 'hidden';
  $allGoodCheck.style.animationName = 'none';
  $messageNoCanvas.removeAttribute('hidden');
  $messageCanvas.setAttribute('hidden', true);
  [].map.call(document.querySelectorAll('.success-fail-message-warning'), (elem) => elem.setAttribute('hidden', true));

  $canvasBtn.dataset.state = '';
  $canvasBtn.setAttribute('disabled', true);
  $canvasBtnText.innerHTML = 'Submit';
  $canvasBtn.dataset.canSubmit = false;
  $canvasBtn.setAttribute('tabindex', -1);
  markbot.disableSubmitAssignment();

  $dropbox.dataset.state = 'visible';
  $messagesWrapper.dataset.state = 'hidden';
  $checksWrapper.dataset.state = 'hidden';
  $statusBar.setAttribute('disabled', true);
  $refreshBtn.setAttribute('disabled', true);
  $refreshBtn.setAttribute('aria-label', 'Refresh');
  $refreshBtn.setAttribute('title', 'Refresh');
  $refreshBtn.setAttribute('data-state', '');
  $openEditorBtn.setAttribute('disabled', true);
  $openBrowserBtn.setAttribute('disabled', true);
  $openRepoBtn.setAttribute('disabled', true);
  $createIssueBtn.setAttribute('disabled', true);
  $repoName.querySelector('.icon-label').innerHTML = '—';
  $repoName.setAttribute('disabled', true);

  $statusBarRed.setAttribute('hidden', true);
  $statusBarYellow.setAttribute('hidden', true);
  $statusBarGreen.setAttribute('hidden', true);
  $statusBarRedText.innerHTML = '—';
  $statusBarYellowText.innerHTML = '—';
  $statusBarGreenText.innerHTML = '—';

  groups = {};
  checks = {};
  console.groupEnd();
  console.group();
};

const refresh = function () {
  if (fullPath && !isRunning()) fileDropped(fullPath);
};

const triggerDoneState = function () {
  if (isRunning()) return;

  clearInterval(isMarkbotDoneYet);
  $messagesLoader.dataset.state = 'hidden';
  $refreshBtn.setAttribute('data-state', '');
  $refreshBtn.setAttribute('aria-label', 'Refresh');
  $refreshBtn.setAttribute('title', 'Refresh');

  if (hasErrors()) {
    $messageHeader.dataset.state = 'errors';
    $robotLogo.setAttribute('aria-label', 'Some checks failed.');
  } else {
    $messageHeader.dataset.state = 'no-errors';
    $robotLogo.setAttribute('aria-label', 'All clear!');
    $submit.dataset.state = 'visible';
    $messages.dataset.state = 'hidden';
    $canvasBtn.removeAttribute('disabled');

    if (hasWarnings()) {
      $messageHeading.innerHTML = successMessages[Math.floor(Math.random() * successMessages.length)] + '-ish!';
      [].map.call(document.querySelector('.success-fail-message:not([hidden])').querySelectorAll('.success-fail-message-warning'), (elem) => elem.removeAttribute('hidden'));
    } else {
      $messageHeading.innerHTML = successMessages[Math.floor(Math.random() * successMessages.length)] + '!';
    }

    if ($canvasBtn.dataset.canSubmit === 'true') markbot.enableSubmitAssignment();
  }
};

const isRunning = function () {
  const allGroups = document.querySelectorAll('#checks ul');

  for(let group of allGroups) {
    let aTags;

    if (group.innerHTML.trim() == '') return true;

    aTags = group.querySelectorAll('li a');

    for (let a of aTags) {
      if (!a.dataset.status || ['computing'].indexOf(a.dataset.status) >= 0) return true;
    }
  };

  return false;
};

const hasErrors = function () {
  const allGroups = document.querySelectorAll('#checks ul');

  for(let group of allGroups) {
    let aTags = group.querySelectorAll('li a');

    for (let a of aTags) {
      if (['bypassed', 'failed'].indexOf(a.dataset.status) >= 0) return true;
    }
  };

  return false;
};

const hasWarnings = function () {
  const allGroups = document.querySelectorAll('#checks ul');

  for(let group of allGroups) {
    let aTags = group.querySelectorAll('li a');

    for (let a of aTags) {
      if (['warnings'].indexOf(a.dataset.status) >= 0) return true;
    }
  };

  return false;
};

const startChecks = function () {
  console.log(fullPath);
  markbot.newDebugGroup(fullPath);
  markbot.onFileDropped(fullPath);
  isMarkbotDoneYet = setInterval(triggerDoneState, 3000);
};

const fileDropped = function (path) {
  if (localStorage.getItem('github-username')) {
    reset();
    fullPath = path;
    startChecks();
    $dropbox.dataset.state = 'hidden';
    $messagesWrapper.dataset.state = 'visible';
    $checksWrapper.dataset.state = 'visible';
    $statusBar.removeAttribute('disabled');
    $refreshBtn.removeAttribute('disabled');
    $refreshBtn.setAttribute('aria-label', 'Computing…');
    $refreshBtn.setAttribute('title', 'Computing…');
    $refreshBtn.setAttribute('data-state', 'computing');
    $openEditorBtn.removeAttribute('disabled');
    $openBrowserBtn.removeAttribute('disabled');
    $openRepoBtn.removeAttribute('disabled');
    $createIssueBtn.removeAttribute('disabled');
  }
};

const statusBarUpdate = function () {
  const allGroups = document.querySelectorAll('#checks ul');
  let redItems = 0;
  let yellowItems = 0;
  let greenItems = 0;

  for(let group of allGroups) {
    let aTags = group.querySelectorAll('li a');

    for (let a of aTags) {
      if (['succeeded'].indexOf(a.dataset.status) >= 0) {
        greenItems++;
        continue;
      }

      if (['warnings'].indexOf(a.dataset.status) >= 0) {
        yellowItems++;
        continue;
      }

      if (['failed'].indexOf(a.dataset.status) >= 0) {
        redItems++;
        continue;
      }
    }
  };

  if (redItems > 0) {
    $statusBarRed.removeAttribute('hidden');
    $statusBarRedText.innerHTML = redItems;
  } else {
    $statusBarRed.setAttribute('hidden', true);
    $statusBarRedText.innerHTML = '—';
  }

  if (yellowItems > 0) {
    $statusBarYellow.removeAttribute('hidden');
    $statusBarYellowText.innerHTML = yellowItems;
  } else {
    $statusBarYellow.setAttribute('hidden', true);
    $statusBarYellowText.innerHTML = '—';
  }

  if (greenItems > 0) {
    $statusBarGreen.removeAttribute('hidden');
    $statusBarGreenText.innerHTML = greenItems;
  } else {
    $statusBarGreen.setAttribute('hidden', true);
    $statusBarGreenText.innerHTML = '—';
  }

  return false;
}

const submitAssignment = function (e) {
  if (e) e.preventDefault();

  if (!hasErrors() && !isRunning()) {
    $canvasBtn.dataset.state = 'processing';
    $canvasBtnText.innerHTML = 'Submitting…';
    markbot.disableSubmitAssignment();

    markbot.submitToCanvas(localStorage.getItem('github-username'), function (err, data) {
      if (!err && data.code == 200) {
        $canvasBtn.dataset.state = 'done';
        $canvasBtnText.innerHTML = 'Submitted';
        $allGoodCheck.style.animationName = 'bounce-check';
      } else {
        $canvasBtn.dataset.state = '';
        $canvasBtnText.innerHTML = 'Submit';
        $allGoodCheck.style.animationName = 'none';
        markbot.enableSubmitAssignment();
        if (data.message) alert(data.message);
      }
    });
  }
};

$body.classList.add(`os-${os.platform()}`);

if (os.platform() == 'darwin') {
  if (parseInt(os.release().split('.')[0]) >= 14) {
    $body.classList.add('macosx-gte-1010');
  } else {
    $body.classList.add('macosx-lt-1010');
  }
}

$body.ondragover = (e) => {
  if (!appIsReady) return false;

  e.stopImmediatePropagation();
  e.stopPropagation();
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';

  return false;
};

$body.ondragleave = (e) => {
  if (!appIsReady) return false;

  e.stopImmediatePropagation();
  e.stopPropagation();
  e.preventDefault();

  return false;
};

$body.ondrop = (e) => {
  if (!appIsReady) return false;

  e.preventDefault();

  if (!fs.statSync(e.dataTransfer.files[0].path).isDirectory()) {
    alert('Drop a folder onto Markbot instead of a single file');
    return false;
  }

  fileDropped(e.dataTransfer.files[0].path);

  return false;
};

document.getElementById('username-form').addEventListener('submit', (e) => {
  e.preventDefault();
  localStorage.setItem('github-username', document.getElementById('username').value);
  markbot.enableSignOut(localStorage.getItem('github-username'));
  $signin.dataset.state = 'hidden';
  $dropbox.dataset.state = 'visible';
});

document.addEventListener('click', (e) => {
  if (e.target.matches('#messages a') || e.target.matches('#messages-positive a')) {
    e.preventDefault();
    shell.openExternal(e.target.href);
  }

  if (e.target.matches('#checks a')) {
    let elem = document.getElementById(e.target.dataset.id);

    e.preventDefault();
    window.location.hash = e.target.dataset.id;

    if (elem) elem.focus();
  }
});

window.addEventListener('will-navigate', (e) => {
  e.preventDefault();
});

$repoName.addEventListener('click', (e) => {
  e.preventDefault();
  markbot.revealFolder();
});

$robotLogo.addEventListener('click', () => refresh());
$refreshBtn.addEventListener('click', () => refresh());
$openBrowserBtn.addEventListener('click', () => markbot.openBrowserToServer());
$createIssueBtn.addEventListener('click', () => markbot.createGitHubIssue());
$openRepoBtn.addEventListener('click', () => markbot.openGitHubRepo());
$openEditorBtn.addEventListener('click', () => markbot.openInCodeEditor());
$canvasBtn.addEventListener('click', () => submitAssignment());

listener.on('app:file-missing', () => {
  reset();
});

listener.on('app:file-exists', (e, repo) => {
  $repoName.querySelector('.icon-label').innerHTML = repo;
  $repoName.removeAttribute('disabled');
});

listener.on('app:all-done', () => {
  triggerDoneState();
});

listener.on('check-group:new', (e, id, label) => {
  const $groupHead = document.createElement('h2');
  const $groupTitle = document.createElement('span');

  groups[id] = {
    label: label,
    elem: document.createElement('ul')
  };

  $groupTitle.classList.add('title-wrap');
  $groupTitle.textContent = label;

  $groupHead.setAttribute('tabindex', 0);
  $groupHead.id = id;
  $groupHead.appendChild($groupTitle);

  $checksLoader.dataset.state = 'hidden';
  $checks.appendChild($groupHead);
  $checks.appendChild(groups[id].elem);
});

listener.on('check-group:item-new', (e, group, id, label) => {
  let checkLi = null;
  let checkId = `${group}-${id}`;
  let checkClass = classify(checkId);
  let groupLabel = group;
  let $groupHeading = document.getElementById(group);

  if (!checks[checkId]) {
    checks[checkId] = document.createElement('a');
    checks[checkId].href = '#' + checkClass;
    checks[checkId].dataset.id = checkClass;
    checkLi = document.createElement('li');
    checkLi.appendChild(checks[checkId]);
    groups[group].elem.appendChild(checkLi);
  }

  if ($groupHeading) groupLabel = $groupHeading.textContent;

  checks[checkId].setAttribute('aria-label', `${groupLabel} — ${label}`);
  checks[checkId].textContent = label;
  statusBarUpdate();
});

listener.on('check-group:item-computing', (e, group, id) => {
  let checkId = `${group}-${id}`;

  checks[checkId].dataset.status = 'computing';
  statusBarUpdate();
});

listener.on('check-group:item-bypass', (e, group, id, label, errors) => {
  let checkId = `${group}-${id}`;

  checks[checkId].dataset.status = 'bypassed';
  checks[checkId].setAttribute('aria-label', checks[checkId].getAttribute('aria-label') + ' — Bypassed')

  displayErrors(group, label, checks[checkId].dataset.id, errors, false, false, ERROR_MESSAGE_STATUS.BYPASS);

  checks[checkId].href += ERROR_MESSAGE_TYPE.ERROR;
  checks[checkId].dataset.id += ERROR_MESSAGE_TYPE.ERROR;

  statusBarUpdate();
});

listener.on('check-group:item-complete', (e, group, id, label, errors, messages, warnings, status) => {
  let checkId = `${group}-${id}`;
  let errorType = ERROR_MESSAGE_TYPE.ERROR;
  const hasErrors = (errors && errors.length > 0);
  const hasWarnings = (warnings && warnings.length > 0);
  const hasMessages = (messages && messages.length > 0);

  if (hasWarnings && !hasErrors) {
    errorType = ERROR_MESSAGE_TYPE.WARNING;
    checks[checkId].dataset.status = 'warnings';
    checks[checkId].setAttribute('aria-label', checks[checkId].getAttribute('aria-label') + ' — Has Warnings')
  }

  if (hasErrors) {
    errorType = ERROR_MESSAGE_TYPE.ERROR;
    checks[checkId].dataset.status = 'failed';
    checks[checkId].setAttribute('aria-label', checks[checkId].getAttribute('aria-label') + ' — Failed')
  }

  if (!hasErrors && !hasWarnings) {
    errorType = ERROR_MESSAGE_TYPE.MESSAGE;
    checks[checkId].dataset.status = 'succeeded';
    checks[checkId].setAttribute('aria-disabled', true);
    checks[checkId].setAttribute('tabindex', -1);
    checks[checkId].setAttribute('aria-label', checks[checkId].getAttribute('aria-label') + ' — Passed')
  }

  displayErrors(group, label, checks[checkId].dataset.id, errors, messages, warnings, status);

  checks[checkId].href += errorType;
  checks[checkId].dataset.id += errorType;

  statusBarUpdate();
})

listener.on('app:re-run', () => {
  refresh(fullPath);
});

listener.on('app:without-github', () => {
  $createIssueBtn.dataset.canBeEnabled = false;
  $createIssueBtn.setAttribute('tabindex', -1);
  $openRepoBtn.dataset.canBeEnabled = false;
  $openRepoBtn.setAttribute('tabindex', -1);
});

listener.on('app:with-github', () => {
  $createIssueBtn.dataset.canBeEnabled = true;
  $createIssueBtn.removeAttribute('tabindex');
  $openRepoBtn.dataset.canBeEnabled = true;
  $openRepoBtn.removeAttribute('tabindex');
});

listener.on('app:with-canvas', () => {
  $canvasBtn.dataset.canSubmit = true;
  $canvasBtn.removeAttribute('tabindex');
  $messageNoCanvas.setAttribute('hidden', true);
  $messageCanvas.removeAttribute('hidden');
  [].map.call(document.querySelectorAll('.success-fail-message-warning'), (elem) => elem.setAttribute('hidden', true));
});

listener.on('app:focus-toolbar', () => {
  $toolbar.focus();
});

listener.on('app:focus-checklist', () => {
  $checksWrapper.focus();
});

listener.on('app:focus-errorlist', () => {
  $messagesWrapper.focus();
});

listener.on('app:sign-out', () => {
  localStorage.clear();
  markbot.disableSignOut();
  markbot.disableFolderMenuFeatures();
  markbot.disableWebServer();
  window.location.reload();
});

listener.on('app:file-dropped', (e, path) => {
  fileDropped(path);
});

listener.on('app:submit-assignment', () => {
  submitAssignment();
});

listener.on('debug', (e, ...args) => {
  markbot.debug(args);
  console.log(...args);
});

listener.on('alert', (e, message) => {
  alert(message);
});

listener.on('app:blur', () => {
  $body.classList.add('window-blurred');
});

listener.on('app:focus', () => {
  $body.classList.remove('window-blurred');
});

listener.on('app:ready', () => {
  appReady();
});

listener.on('error:missing-dependency', (e, deps) => {
  $loader.dataset.state = 'hidden';
  $dependencies.dataset.state = 'visible';

  if (deps.hasGit === false) {
    document.getElementById('dep-git').dataset.state = 'visible';
  } else {
    document.getElementById('dep-git').dataset.state = 'hidden';
  }

  if (deps.hasJava === false) {
    document.getElementById('dep-java').dataset.state = 'visible';
  } else {
    document.getElementById('dep-java').dataset.state = 'hidden';
  }
});
