// TODO: attachStartFixed e.g. https
// TODO: auto-suffix (ing, s, es, ed)

// #STKPWHRAO*EUFRPBLGTSDZ
function stenoTapeToSteno(steno) {
  let ans = '';
  for(let stroke of steno) {
    if(stroke.length < 23) {
      stroke = ' ' + stroke;
    }
    if(stroke[0] === '#') {
      stroke = ' ' +
      (stroke[1] === ' ' ? ' ' : '1') +
      (stroke[2] === ' ' ? ' ' : '2') + stroke[3] +
      (stroke[4] === ' ' ? ' ' : '3') + stroke[5] +
      (stroke[6] === ' ' ? ' ' : '4') + stroke[7] +
      (stroke[8] === ' ' ? ' ' : '5') +
      (stroke[9] === ' ' ? ' ' : '0') + stroke.slice(10, 13) +
      (stroke[13] === ' ' ? ' ' : '6') + stroke[14] +
      (stroke[15] === ' ' ? ' ' : '7') + stroke[16] +
      (stroke[17] === ' ' ? ' ' : '8') + stroke[18] +
      (stroke[19] === ' ' ? ' ' : '9') + stroke.slice(20);
    }

    ans += stroke.slice(0, 13).replace(/ /g,'');
    if(stroke.slice(13).replace(/ /g, '').length === 0) {
      ans += ' ';
      continue;
    }
    if(stroke.slice(8, 13).replace(/ /g,'').length === 0) {
      ans += '-';
    }
    ans += stroke.slice(13).replace(/ /g,'') + ' ';
  }
  return ans.slice(0, -1);
}

function stenoToStenoTape(steno) {
  let ans = [];
  let strokes = steno.replace(/\//g,' ').split(' ');
  for(let stroke of strokes) {
    let str = stroke.slice();

    const numberTranslation = {
      '0': 'O',
      '1': 'S',
      '2': 'T',
      '3': 'P',
      '4': 'H',
      '5': 'A',
      '6': '-F',
      '7': '-P',
      '8': '-L',
      '9': '-T',
    };

    for(let number in numberTranslation) {
      if(str.indexOf(number) >= 0) {
        if(str[0] !== '#') {
          str = '#' + str;
        }
        str = str.replace(number, numberTranslation[number]);
      }
    }

    let stenoOrder = '#STKPWHRAO*EUFRPBLGTSDZ';

    for(let i = 0; i < stenoOrder.length; i++) {
      if(i > 10) {
        if(str[i] === '-') {
          str = str.substring(0, i) + str.substring(i + 1);
        }
      }
      if(str[i] !== stenoOrder[i]) {
        str = str.substring(0, i) + ' ' + str.substring(i);
      }
    }

    ans.push(str);
  }
  return ans;
}

const isSteno = /^(#?[S1]?[T2]?K?[P3]?W?[H4]?R?[A5]?[O0]?[\*\-]?E?U?[F6]?R?[P7]?B?[L8]?G?[T9]?S?D?Z?\/)*(#?[S1]?[T2]?K?[P3]?W?[H4]?R?[A5]?[O0]?[\*\-]?E?U?[F6]?R?[P7]?B?[L8]?G?[T9]?S?D?Z?)$/;

// The parsing code here is, in effect, a JS copy of Plover's:
// https://github.com/openstenoproject/plover/blob/master/plover/formatting.py
const Case = {
  CAP_FIRST_WORD: 'cap_first_word',
  LOWER_FIRST_CHAR: 'lower_first_char',
  UPPER_FIRST_WORD: 'upper_first_word',
  LOWER: 'lower',
  UPPER: 'upper',
  TITLE: 'title',
};

const Macros = {
  '{*}': '=retrospective_toggle_asterisk',
  '{*!}': '=retrospective_delete_space',
  '{*?}': '=retrospective_insert_space',
  '{*+}': '=repeat_last_stroke',
};

function buildMetasParser(metas) {
  let matchFromLastIndex = [false];
  let regexParts = [];

  for(let meta of metas) {
    let pattern = meta[0];
    let name = meta[1];
    let param = meta[2];

    let numPrevGroups = matchFromLastIndex.length;
    let numGroups = ''.match(pattern + '|').length - 1;

    if(typeof name === 'number') {
      name += numPrevGroups;
    }
    if(typeof param === 'number') {
      param += numPrevGroups;
    }

    if(numGroups === 0) {
      numGroups = 1;
    }
    else {
      pattern = '?:' + pattern;
    }

    let groups = [];
    for(let n = 0; n < numGroups; n++) {
      groups.push(n + numPrevGroups);
    }

    matchFromLastIndex = matchFromLastIndex.concat(new Array(groups.length).fill([name, param]));

    regexParts.push('(' + pattern + ')$');
  }

  let regex = RegExp(regexParts.join('|'), 'is');

  return (meta) => {
    let m = meta.match(regex);
    if(!m) {
      let name = meta;
      for(let alias in Macros) {
        if(`{${meta}}` === alias) {
          return [Macros[alias], false];
        }
      }
      return [name, false];
    }
    let lastIndex = matchFromLastIndex.length;
    while(!m[lastIndex]) lastIndex--;
    let [metaName, metaParam] = matchFromLastIndex[lastIndex];
    if(typeof metaName === 'number') {
      metaName = m[metaName];
    }
    if(typeof metaParam === 'number') {
      metaParam = m[metaParam];
    }
    return [metaName, metaParam];
  }
}

const parseMeta = buildMetasParser([
  // Generic {:macro:cmdline} syntax
  [':([^:]+):?(.*)', 0, 1],
  // Command
  ['PLOVER:(.*)', 'command', 0],
  // Key combination
  ['#(.*)', 'key_combo', 0],
  // Punctuation
  ['([,:;])', 'comma', 0],
  ['([.!?])', 'stop' , 0],
  // Case
  ['-\\|', 'case', Case.CAP_FIRST_WORD],
  ['>', 'case', Case.LOWER_FIRST_CHAR],
  ['<', 'case', Case.UPPER_FIRST_WORD],
  ['\\*-\\|', 'retro_case', Case.CAP_FIRST_WORD],
  ['\\*>', 'retro_case', Case.LOWER_FIRST_CHAR],
  ['\\*<', 'retro_case', Case.UPPER_FIRST_WORD],
  // Explicit word end
  ['(\\$)', 'word_end', 0],
  // Conditional
  ['=(.*)', 'if_next_matches', 0],
  // Mode
  ['MODE:(.*)', 'mode', 0],
  // Currency
  ['\\*\\((.*)\\)', 'retro_currency', 0],
  // Glue
  ['&(.*)', 'glue' , 0],
  // Carry capitalization
  ['(\\^?~\\|.*\\^?)', 'carry_capitalize', 0],
  // Attach
  ['(\\^.*\\^?)', 'attach', 0],
  ['(.*\\^)', 'attach', 0],
]);

const ATOM_RE = /(?:\\\\{|\\\\}|[^{}])+|{(?:\\\\{|\\\\}|[^{}])*}/g;
const WORD_RX = /(?:\d+(?:[.,]\d+)+|[\'\w]+[-\w\']*|[^\w\s]+)\s*/g;

const defaultState = {
  spaceChar: ' ',
  case: false,
  caseMode: false,
  mode: false,
  lastStrokeWasGlue: false,
  startAttached: true,
  startCapitalized: true,
  ifNextMatches: false
};

const startingState = {
  spaceChar: ' ',
  case: Case.CAP_FIRST_WORD,
  caseMode: false,
  mode: false,
  lastStrokeWasGlue: false,
  startAttached: true,
  startCapitalized: true,
  ifNextMatches: false
};

function getMeta(atom) {
  if(atom && atom[0] === '{' && atom[atom.length - 1] === '}') {
    return atom.slice(1, atom.length - 1);
  }
  return false;
}

function atomToAction(atom) {
  let action;
  let meta = getMeta(atom);
  if(meta) {
    meta = meta.replace(/\\{/g, '{').replace(/\\}/g, '}');
    action = parseMeta(meta);
  }
  else {
    action = ['raw', atom];
  }

  return action;
}

function entryToActions(str) {
  let atoms = [];
  if(/^[0-9]*$/.test(str)) {
    atoms = [`{&${str}}`];
  }
  else if(/^[0-9\*]*$/.test(str)) {
    atoms = [`{&${str.replace('*','').split('').reverse().join('')}}`];
  }
  else {
    atoms = [...str.matchAll(ATOM_RE)].map(a => a[0]);
    atoms = atoms.filter(a => a.trim() !== '');
  }
  let actionList = [];
  for(let atom of atoms) {
    let action = atomToAction(atom);
    actionList.push(action);
  }
  return actionList;
}

function appendTextCase(txt, add, state) {
  if(add === '') {
    return txt;
  }
  let ans = txt;

  let wasState = JSON.parse(JSON.stringify(state));

  if(!state.startAttached) {
    ans += state.spaceChar;
  }

  switch(state.case) {
    case Case.CAP_FIRST_WORD:
      if(state.startCapitalized) {
        switch(state.caseMode) {
          case Case.LOWER:
            ans += add[0].toUpperCase() + add.slice(1).toLowerCase();
          break;
          case Case.UPPER:
            ans += add[0].toUpperCase() + add.slice(1).toUpperCase();
          break;
          default:
            ans += add[0].toUpperCase() + add.slice(1);
        }
        state.case = false;
      }
      else {
        switch(state.caseMode) {
          case Case.LOWER:
            ans += add.toLowerCase();
          break;
          case Case.UPPER:
            ans += add.toUpperCase();
          break;
          default:
            ans += add;
        }
      }
    break;
    case Case.LOWER_FIRST_CHAR:
      switch(state.caseMode) {
        case Case.LOWER:
          ans += add[0].toLowerCase() + add.slice(1).toLowerCase();
        break;
        case Case.UPPER:
          ans += add[0].toLowerCase() + add.slice(1).toUpperCase();
        break;
        default:
          ans += add[0].toLowerCase() + add.slice(1);
      }
      state.case = false;
    break;
    case Case.UPPER_FIRST_WORD:
      ans += add.toUpperCase();
      state.case = false;
    break;
    default:
      switch(state.caseMode) {
        case Case.LOWER:
          ans += add.toLowerCase();
        break;
        case Case.UPPER:
          ans += add.toUpperCase();
        break;
        case Case.TITLE:
        if(state.startCapitalized) {
          ans += add[0].toUpperCase() + add.slice(1);
        } else {
          ans += add;
        }
        break;
        default:
          ans += add;
      }
  }

  if(state.ifNextMatches) {
    let addedText = ans.replace(txt, '');
    if(addedText[0] === ' ') {
      addedText = addedText.slice(1);
    }
    let matches = state.ifNextMatches;
    for(let key in state) {
      state[key] = wasState[key];
    }
    state.ifNextMatches = false;

    if(RegExp('^' + matches[0]).test(addedText)) {
      ans = appendTextCase(txt, matches[1], state);
    }
    else {
      ans = appendTextCase(txt, matches[2], state);
    }
    ans = appendTextCase(ans, addedText, state);
  }

  return ans;
}

function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
// the main parser
function parseDictionaryEntry(str, oldState = defaultState) {
  let state = JSON.parse(JSON.stringify(oldState));
  let retroCase = false;
  let retroCurrency = false;
  let appendText = '';
  let newWord = !state.ifNextMatches;
  let macro = false;

  let actions = entryToActions(str);

  for(let [action, param] of actions) {
    // TODO: apply casing to phrases
    param = param ? param.replace(/ /g, state.spaceChar) : false;
    let lastWasGlue = state.lastStrokeWasGlue;
    state.lastStrokeWasGlue = false;
    let temp;
    switch(action) {
      case 'raw':
        appendText = appendTextCase(appendText, param, state);
        state.startAttached = false;
      break;
      case 'stop':
        temp = state.spaceChar;
        state.spaceChar = '';
        appendText = appendTextCase(appendText, param, state);
        state.spaceChar = temp;
        state.case = Case.CAP_FIRST_WORD;
        state.startCapitalized = true;
      break;
      case 'comma':
        temp = state.spaceChar;
        state.spaceChar = '';
        appendText = appendTextCase(appendText, param, state);
        state.spaceChar = temp;
      break;
      case 'attach':
        if(param[0] === '^' || param.indexOf('^') < 0) {
          state.startAttached = true;
        }
        if(param.replace(/\^/g).length) {
          appendText = appendTextCase(appendText, param.replace(/\^/g,''), state);
          state.startAttached = false;
        }
        if(param[param.length - 1] === '^') {
          state.startAttached = true;
        }
        if(/[\.\?\!]/.test(param.replace(/\^/g)[param.replace(/\^/g).length - 1])) {
          state.case = Case.CAP_FIRST_WORD;
          state.startCapitalized = true;
        }
      break;
      case 'glue':
        state.lastStrokeWasGlue = true;
        if(lastWasGlue) {
          state.startAttached = true;
          if(appendText === '') {
            newWord = false;
          }
        }
        appendText = appendTextCase(appendText, param, state);
        state.startAttached = false;
      break;
      case 'word_end':
        state.startAttached = false;
        if(appendText === '') {
          newWord = true;
        }
      break;
      case 'case':
        switch(param) {
          case Case.CAP_FIRST_WORD:
          case Case.LOWER_FIRST_CHAR:
          case Case.UPPER_FIRST_WORD:
            state.case = param;
          break;
          case Case.LOWER:
          case Case.UPPER:
          case Case.TITLE:
            state.caseMode = param;
          break;
          defualt:
            state.caseMode = false;
        }
      break;
      case 'retro_case':
        retroCase = param;
        if(appendText === '') {
          newWord = false;
        }
      break;
      case 'carry_capitalize':
        let caseState = [state.case, state.startCapitalized];
        let reduced = param.replace(/~\|/i,'');
        if(/\^|(:attach)/.test(reduced)) {
          let parsed = parseDictionaryEntry(`{${reduced}}`, state);
          appendText += parsed.appendText;
          state = parsed.state;
        }
        else {
          appendText = appendTextCase(appendText, reduced, state);
          state.startAttached = false;
        }

        [state.case, state.startCapitalized] = caseState;
      break;
      case 'retro_currency':
        retroCurrency = param;
        if(appendText === '') {
          newWord = false;
        }
      break;
      case 'if_next_matches':
        let params = param.replace(/\\\//g,'<TMP_ESC>').split('/').
          map(a => a.replace(/<TMP_ESC>/, '\\\/'));
        state.ifNextMatches = params;
      break;
      case '=repeat_last_stroke':
        macro = action;
      break;
      default:
        console.error(`ERROR| no action: ${action}`);
    }
  }

  return {appendText, newWord, retroCase, retroCurrency, macro, state};
}

function stenoNumber(word) {
  let ans = [];
  let at = 0;

  while(at < word.length) {
    let ascending = word.slice(at).match(/^(1|)(2|)(3|)(4|)(5|)(0|)(6|)(7|)(8|)(9|)/)[0];
    let descending = word.slice(at).match(/^(9|)(8|)(7|)(6|)(0|)(5|)(4|)(3|)(2|)(1|)/)[0];
    descending = descending.split('').reverse().join('');
    if(descending.length > ascending.length) {
      at += descending.length;
      let txt = '';
      while(/[1-4]/.test(descending)) {
        txt += descending[0];
        descending = descending.slice(1);
      }
      while(/[05]/.test(descending)) {
        txt += descending[0];
        descending = descending.slice(1);
      }
      txt += '*';
      while(/[6-9]/.test(descending)) {
        txt += descending[0];
        descending = descending.slice(1);
      }
      ans.push(txt);
    }
    else {
      at += ascending.length;
      let txt = '';
      while(/[1-4]/.test(ascending)) {
        txt += ascending[0];
        ascending = ascending.slice(1);
      }
      if(ascending === '') {
        ans.push(txt);
        continue;
      }
      if(!/[05]/.test(ascending)) {
        txt += '-';
      }
      while(/[05]/.test(ascending)) {
        txt += ascending[0];
        ascending = ascending.slice(1);
      }
      while(/[6-9]/.test(ascending)) {
        txt += ascending[0];
        ascending = ascending.slice(1);
      }
      ans.push(txt);
    }
  }

  return ans;
}

function shortestStroke(a, b) {
  return(
    (
      a[0].join(' ').split(/[ \/]/).length * 1e4 +
      a[0].join('').replace(/[ \/-]/g, '').length
    ) - (
      b[0].join(' ').split(/[ \/]/).length * 1e4 +
      b[0].join('').replace(/[ \/-]/g, '').length
    )
  );
}
