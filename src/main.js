let txt = document.getElementById('txt');
let errors = document.getElementById('errors');
let result = document.getElementById('txt-result');
let download = document.getElementById('download');
let dropZone = document.getElementById('dropZone');

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toGrouped(textCode) {
  let ans = [];
  let state = JSON.parse(JSON.stringify(startingState));

  let txt = '';
  let strokes = [];

  for(let group of textCode) {
    let parsed = parseDictionaryEntry(group[0], state);

    if(parsed.retroCase) {
      switch(parsed.retroCase) {
        case Case.CAP_FIRST_WORD:
        case Case.TITLE:
          txt = txt.split(' ');
          txt[txt.length - 1] =
            txt[txt.length - 1][0].toUpperCase() +
            txt[txt.length - 1].slice(1);
          txt = txt.join(' ');
          break;
        case Case.LOWER_FIRST_CHAR:
          txt = txt.split(' ');
          txt[txt.length - 1] =
            txt[txt.length - 1][0].toLowerCase() +
            txt[txt.length - 1].slice(1);
          txt = txt.join(' ');
          break;
        case Case.LOWER:
          txt = txt.split(' ');
          txt[txt.length - 1] = txt[txt.length - 1].toLowerCase();
          txt = txt.join(' ');
          break;
        case Case.UPPER_FIRST_WORD:
        case Case.UPPER:
          txt = txt.split(' ');
          txt[txt.length - 1] = txt[txt.length - 1].toUpperCase();
          txt = txt.join(' ');
          break;
      }
    }

    if(parsed.retroCurrency) {
      let indexOfC = parsed.retroCurrency.indexOf('c');
      let hasPoint = txt.indexOf('.') >= 0;
      let hasSpace = txt[0] === ' ';
      if(hasSpace) txt = txt.slice(1);
      if(txt.indexOf('.') >= 0) {
        txt = txt.split('.');
        txt[txt.length - 1] = txt[txt.length - 1].padEnd(2, 0);
        txt = txt.join('.');
      }
      txt = (hasSpace ? ' ' : '') +
        parsed.retroCurrency.slice(0, indexOfC) +
        (hasPoint ? txt.split('.')[0] : txt).split('').reduceRight(
          (a, b) => b + (a && a.length % 4 === 3 ? ',' : '') + a, ''
        ) + (
          hasPoint ? '.' + txt.split('.')[1] +
          parsed.retroCurrency.slice(indexOfC + 1) : ''
        );
    }

    if(/^[.,!?:;]$/.test(parsed.appendText) || (txt.length > 0 && parsed.newWord && strokes.length > 0)) {
      ans.push([txt, strokes.join('/')]);
      txt = '';
      strokes = [];
    }
    if(txt.length > 0 && txt[txt.length - 1] !== '/' && parsed.appendText[0] !== '/') {
      txt += '/';
    }
    txt += parsed.appendText;
    state = parsed.state;
    strokes.push(group[1]);
  }

  ans.push([txt, strokes.join('/')]);

  return ans;
}

function toStenoGrouped(txt) {
  let ans = [];
  let lines = txt.split('\n');
  for(let i = 0; i < lines.length; i++) {
    let ln = lines[i].split(' ').slice(2);
    if(ln && ln.length > 0 && ln[0].indexOf('Translation(') === 0) {
      let stroke = ln.slice(0, ln.indexOf(':')).map(a => a.slice(1, a.length - 2)).join(' ')
        .replace(/^ranslation\(\('/, '')
        .replace(/'$/, '');
      let txt = ln.slice(ln.indexOf(':') + 1).join(' ').replace(/^"/, '').replace(/"\)$/, '');
      ans.push([txt, stroke]);
      continue;
    }
    if(ln && ln.length > 0 && ln[0].indexOf('*Translation(') === 0) {
      ans.pop();
      continue;
    }
  }

  if(ans.length === 0) {
    errors.innerHTML = `<span class='error'>No translation logs found <a href='https://github.com/EFHIII/LessonGen'>help</a></span>`;
    result.innerHTML = '';
    return;
  }

  //try {
  //}
  //catch(e) {
  //  errors.innerHTML = `<span class='error'>Invalid logs:</span>`;
  //  result.innerHTML = nxt.string.slice(Math.max(0, nxt.index - 20), nxt.index + 20) +
  //  '\n' +
  //  new Array(Math.min(nxt.index + 1, 21)).fill('').join(' ') + '^';
  //  return;
  //}

  if(document.getElementById('underlineBriefs').checked) {
    for(let l in ans) {
      if(/\w \w/.test(ans[l][0])) {
        ans[l][0] = `_${ans[l][0]}_`;
      }
    }
  }

  ans = ans.map(a => a[0] === 'None)' ? [a[1], a[1]] : a);

  return toGrouped(ans);
}

let waiting = false;
let waitingTimeout;

function update(wait = false) {
  if(wait) {
    if(waiting) {
      waiting = Date.now();
      clearTimeout(waitingTimeout);
      waitingTimeout = setTimeout(update, 300);
    } else {
      waiting = Date.now();
      waitingTimeout = setTimeout(update, 300);
    }
    return;
  }

  clearTimeout(waitingTimeout);
  waiting = false;
  download.style.display = 'none';
  let grouped = toStenoGrouped(txt.value.trim());

  if(!grouped) {
    return;
  }

  let groupedWords = [
    [...grouped[0]]
  ];
  for(let i = 1; i < grouped.length; i++) {
    if(grouped[i][0][0] === ' ' ||
      /^\s*([^\w\d]+ ?)+$/.test(grouped[i][0]) ||
      /^\s*([^\w\d]+ ?)+$/.test(groupedWords[groupedWords.length - 1][0])) {
      groupedWords.push([...grouped[i]]);
    } else {
      groupedWords[groupedWords.length - 1][0] += '/' + grouped[i][0];
      groupedWords[groupedWords.length - 1][1] += '/' + grouped[i][1];
    }
  }

  for(let group in groupedWords) {
    if(!groupedWords[group][1].match(/\//g) || groupedWords[group][1].match(/\//g).length === 1) continue;
    if(groupedWords[group][0].match(/\//g).length !== groupedWords[group][1].match(/\//g).length) {
      groupedWords[group][0] = groupedWords[group][0].replace(/\//g, '');
    }
  }

  let longest = groupedWords.reduce((a, b) => Math.max(b[1].length, a), 0);

  errors.innerHTML = ``;
  result.innerHTML = groupedWords.map(a => a[1].padEnd(longest, ' ') + '???' + a[0] + '\n').join('');
  download.style.display = 'inline';
}

function downloadLesson() {
  let grouped = toStenoGrouped(txt.value.trim());

  let groupedWords = [
    [...grouped[0]]
  ];
  for(let i = 1; i < grouped.length; i++) {
    if(grouped[i][0][0] === ' ' ||
      /^\s*([^\w\d]+ ?)+$/.test(grouped[i][0]) ||
      /^\s*([^\w\d]+ ?)+$/.test(groupedWords[groupedWords.length - 1][0])) {
      groupedWords.push([...grouped[i]]);
    } else {
      groupedWords[groupedWords.length - 1][0] += '/' + grouped[i][0];
      groupedWords[groupedWords.length - 1][1] += '/' + grouped[i][1];
    }
  }

  for(let group in groupedWords) {
    if(!groupedWords[group][1].match(/\//g) || groupedWords[group][1].match(/\//g).length === 1) continue;
    if(groupedWords[group][0].match(/\//g).length !== groupedWords[group][1].match(/\//g).length) {
      groupedWords[group][0] = groupedWords[group][0].replace(/\//g, '');
    }
  }

  for(let group in groupedWords) {
    groupedWords[group][1] = groupedWords[group][1].replace(/\//g, ' ');
  }

  groupedWords = groupedWords.map(a => a[0].trim() + '\n ' + (a[0][0] === ' ' ? '' : '/') + a[1]);

  groupedWords[0] = groupedWords[0].replace('\n /', '\n ');

  let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(groupedWords.join('\n'));
  let downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "my-lesson.txt");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}


function parseFile(file) {
  //read the file
  const reader = new FileReader();
  reader.onload = function(e) {
    txt.value = e.target.result.split('\n').filter(a => {
      return /^\*?Translation\(/.test(a.split(' ')[2]);
    }).join('\n');
    update();
  }
  reader.readAsText(file);
}


document.addEventListener('keydown', _ => update(true));

download.addEventListener('click', _ => downloadLesson());

document.getElementById('underlineBriefs').addEventListener('change', update);

window.addEventListener('dragenter', e => {
  dropZone.style.visibility = 'visible';
});

function allowDrag(e) {
  e.dataTransfer.dropEffect = 'copy';
  e.preventDefault();
}

function handleDrop(e) {
  e.preventDefault();
  dropZone.style.visibility = 'hidden';

  parseFile(e.dataTransfer.files[0]);
}

dropZone.addEventListener('dragleave', e => {
  if(e.fromElement === null) {
    dropZone.style.visibility = 'hidden';
  }
});

dropZone.addEventListener('dragenter', allowDrag);
dropZone.addEventListener('dragover', allowDrag);


dropZone.addEventListener('drop', handleDrop);
