// Ameple — Apple iOS 18 Emoji System
// Replaces ALL emoji characters with Apple Color Emoji PNG images.
// CDN: emoji-datasource-apple (iamcal/emoji-data)

(function () {
  'use strict';

  var CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64/';

  // Track processing state to prevent infinite MutationObserver loops
  var isParsing = false;
  var observer = null;

  // Cache for filenames we've already verified or failed
  var failedCache = {};

  // ---- Emoji detection regex ----
  // Matches: flag sequences, standard emoji, keycaps, symbols
  // Uses the 'u' flag for proper Unicode handling
  var EMOJI_RE = new RegExp(
    // Regional indicator flag pairs (🇦🇫 through 🇿🇼)
    '[\\u{1F1E6}-\\u{1F1FF}]{2}'
    // OR: emoji followed by optional variation selector / ZWJ sequences
    + '|[\\u{1F600}-\\u{1F64F}][\\u{FE0F}\\u{200D}\\u{1F300}-\\u{1FAFF}]*'
    + '|[\\u{1F300}-\\u{1F5FF}][\\u{FE0F}\\u{200D}\\u{1F300}-\\u{1FAFF}]*'
    + '|[\\u{1F680}-\\u{1F6FF}][\\u{FE0F}\\u{200D}\\u{1F300}-\\u{1FAFF}]*'
    + '|[\\u{1F900}-\\u{1F9FF}][\\u{FE0F}\\u{200D}\\u{1F300}-\\u{1FAFF}]*'
    + '|[\\u{1FA00}-\\u{1FAFF}][\\u{FE0F}\\u{200D}\\u{1F300}-\\u{1FAFF}]*'
    // Dingbats and misc symbols with optional VS16
    + '|[\\u{2702}-\\u{27B0}]\\u{FE0F}?'
    + '|[\\u{2600}-\\u{26FF}]\\u{FE0F}?'
    // Common standalone emoji with VS16
    + '|[\\u{2764}\\u{2728}\\u{2744}\\u{2712}\\u{270D}\\u{270F}\\u{2714}\\u{2716}\\u{271D}\\u{2721}\\u{2733}\\u{2734}\\u{2747}\\u{274C}\\u{274E}\\u{2757}\\u{2763}\\u{27A1}\\u{2934}\\u{2935}\\u{2B05}-\\u{2B07}\\u{2B1B}\\u{2B1C}\\u{2B50}\\u{2B55}\\u{231A}\\u{231B}\\u{23E9}-\\u{23F3}\\u{23F8}-\\u{23FA}\\u{25AA}\\u{25AB}\\u{25B6}\\u{25C0}\\u{25FB}-\\u{25FE}\\u{3030}\\u{303D}\\u{3297}\\u{3299}]\\u{FE0F}?',
    'gu'
  );

  // Quick check: does a string contain any emoji-range character?
  var HAS_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{3030}\u{303D}\u{3297}\u{3299}]/u;

  // ---- Codepoint helpers ----

  function emojiToCodepoints(emoji) {
    var pts = [];
    for (var i = 0; i < emoji.length;) {
      var cp = emoji.codePointAt(i);
      // Skip ZWJ (0x200D) in filename but keep FE0F
      if (cp !== 0x200D) {
        pts.push(cp.toString(16));
      }
      i += cp > 0xFFFF ? 2 : 1;
    }
    return pts;
  }

  function emojiToFilename(emoji) {
    return emojiToCodepoints(emoji).join('-');
  }

  function isFlag(emoji) {
    var cp = emoji.codePointAt(0);
    return cp >= 0x1F1E6 && cp <= 0x1F1FF && emoji.codePointAt(2) >= 0x1F1E6;
  }

  // ---- Build <img> HTML ----

  function buildImgHTML(emoji, extraClass) {
    var filename = emojiToFilename(emoji);
    if (failedCache[filename]) return emoji; // Already known to fail, use raw text

    var cls = 'apple-emoji';
    if (extraClass) cls += ' ' + extraClass;
    if (isFlag(emoji)) cls += ' flag-emoji';

    return '<img src="' + CDN + filename + '.png"'
      + ' alt="' + emoji + '"'
      + ' class="' + cls + '"'
      + ' draggable="false"'
      + ' loading="lazy">';
  }

  // ---- Global error handler for failed emoji images ----
  // Uses event delegation instead of inline onerror (prevents loops)
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.classList.contains('apple-emoji')) return;

    var src = img.src || '';
    var alt = img.alt || '';

    // Extract filename from URL
    var match = src.match(/\/64\/([^.]+)\.png/);
    if (match) {
      var filename = match[1];

      // If this has FE0F, try without it
      if (filename.indexOf('-fe0f') !== -1 && !img.dataset.retried) {
        img.dataset.retried = '1';
        img.src = CDN + filename.replace(/-fe0f/g, '') + '.png';
        return;
      }

      // If we tried without FE0F and it's not there, try adding FE0F
      if (filename.indexOf('fe0f') === -1 && !img.dataset.retried2) {
        img.dataset.retried2 = '1';
        img.src = CDN + filename + '-fe0f.png';
        return;
      }

      // Mark as permanently failed
      failedCache[filename] = true;
    }

    // Replace with styled fallback text (NOT a raw text node — prevents re-parsing loops)
    var fallback = document.createElement('span');
    fallback.className = 'emoji-fallback';
    fallback.setAttribute('data-emoji-done', '1');
    fallback.textContent = alt;
    img.replaceWith(fallback);
  }, true); // capture phase to catch load errors

  // ---- DOM parsing ----

  function parseElement(el) {
    if (!el) el = document.body;
    if (!el || !el.querySelectorAll) return;

    // Pause observer while we modify DOM
    if (observer) observer.disconnect();
    isParsing = true;

    try {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var p = node.parentNode;
          if (!p) return NodeFilter.FILTER_REJECT;
          var tag = p.tagName;
          // Skip: scripts, styles, inputs, already-processed nodes
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' ||
              tag === 'INPUT' || tag === 'NOSCRIPT' || p.isContentEditable) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip if parent is already an emoji img or a processed fallback
          if (p.classList && (p.classList.contains('apple-emoji') ||
              p.classList.contains('emoji-fallback') ||
              p.dataset.emojiDone === '1')) {
            return NodeFilter.FILTER_REJECT;
          }
          // Only process text that actually contains emoji characters
          if (HAS_EMOJI.test(node.textContent)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      });

      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);

      for (var i = 0; i < nodes.length; i++) {
        var textNode = nodes[i];
        var text = textNode.textContent;
        EMOJI_RE.lastIndex = 0;
        if (!EMOJI_RE.test(text)) continue;

        EMOJI_RE.lastIndex = 0;
        var html = text.replace(EMOJI_RE, function (m) {
          return buildImgHTML(m);
        });

        if (html !== text) {
          var wrapper = document.createElement('span');
          wrapper.dataset.emojiDone = '1';
          wrapper.innerHTML = html;
          if (textNode.parentNode) {
            textNode.parentNode.replaceChild(wrapper, textNode);
          }
        }
      }
    } finally {
      isParsing = false;
      // Reconnect observer
      if (observer) {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    }
  }

  // ---- Debounced parse for observer ----
  var parseTimer = null;
  function scheduleParse() {
    if (parseTimer) return; // Already scheduled
    parseTimer = setTimeout(function () {
      parseTimer = null;
      if (!isParsing) parseElement(document.body);
    }, 80);
  }

  // ---- Initialize ----
  document.addEventListener('DOMContentLoaded', function () {
    // First parse
    parseElement(document.body);

    // Observe DOM changes for dynamic content
    observer = new MutationObserver(function (mutations) {
      if (isParsing) return; // We caused this mutation, ignore

      var dominated = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          // Skip our own injected nodes
          if (node.nodeType === 1 && node.dataset && node.dataset.emojiDone === '1') continue;
          if (node.nodeType === 1 && node.classList && node.classList.contains('apple-emoji')) continue;
          if (node.nodeType === 1 && node.classList && node.classList.contains('emoji-fallback')) continue;

          var content = (node.textContent || '');
          if (HAS_EMOJI.test(content)) {
            dominated = true;
            break;
          }
        }
        if (dominated) break;
      }
      if (dominated) scheduleParse();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });

  // ---- Public API ----
  window.AmepleEmoji = {
    parse: parseElement,

    // Convert a single emoji string to an <img> HTML string
    toImg: function (emoji) {
      if (!emoji) return '';
      EMOJI_RE.lastIndex = 0;
      return emoji.replace(EMOJI_RE, function (m) {
        return buildImgHTML(m);
      });
    },

    // Specifically for flag emojis (used by TomSelect renderers)
    flagToImg: function (flagEmoji) {
      if (!flagEmoji) return '';
      return buildImgHTML(flagEmoji, 'ts-flag');
    },

    // Replace emojis in an HTML string
    replaceInHTML: function (html) {
      if (!html) return '';
      EMOJI_RE.lastIndex = 0;
      return html.replace(EMOJI_RE, function (m) {
        return buildImgHTML(m);
      });
    },

    toFilename: emojiToFilename
  };

})();
