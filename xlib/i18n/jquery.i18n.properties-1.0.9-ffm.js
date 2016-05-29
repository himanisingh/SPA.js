(function($) {
  $.i18n = {};
  $.i18n.map = {};
  $.i18n.properties = function(settings) {
    var defaults = {
      name: "Messages",
      language: "",
      path: "",
      mode: "vars",
      cache: false,
      encoding: "UTF-8",
      callback: null
    };
    settings = $.extend(defaults, settings);
    if (settings.language === null || settings.language == "") {
      settings.language = $.i18n.browserLang()
    }
    if (settings.language === null) {
      settings.language = ""
    }
    var files = getFiles(settings.name);
    for (i = 0; i < files.length; i++) {
      loadAndParseFile(settings.path + files[i] + ((settings.language.length > 1) ? "_" : "") + settings.language + ".properties", settings)
    }
    if (settings.callback) {
      settings.callback()
    }
  };
  $.i18n.prop = function(key) {
    key = (key || '').replace(/\s/g, '');
    var value = $.i18n.map[key];
    if (value == null) {
      return "[" + key + "]"
    }
    var i;
    if (typeof(value) == "string") {
      i = 0;
      while ((i = value.indexOf("\\", i)) != -1) {
        if (value[i + 1] == "t") {
          value = value.substring(0, i) + "\t" + value.substring((i++) + 2)
        } else {
          if (value[i + 1] == "r") {
            value = value.substring(0, i) + "\r" + value.substring((i++) + 2)
          } else {
            if (value[i + 1] == "n") {
              value = value.substring(0, i) + "\n" + value.substring((i++) + 2)
            } else {
              if (value[i + 1] == "f") {
                value = value.substring(0, i) + "\f" + value.substring((i++) + 2)
              } else {
                if (value[i + 1] == "\\") {
                  value = value.substring(0, i) + "\\" + value.substring((i++) + 2)
                } else {
                  value = value.substring(0, i) + value.substring(i + 1)
                }
              }
            }
          }
        }
      }
      var arr = [],
        j, index;
      i = 0;
      while (i < value.length) {
        if (value[i] == "'") {
          if (i == value.length - 1) {
            value = value.substring(0, i)
          } else {
            if (value[i + 1] == "'") {
              value = value.substring(0, i) + value.substring(++i)
            } else {
              j = i + 2;
              while ((j = value.indexOf("'", j)) != -1) {
                if (j == value.length - 1 || value[j + 1] != "'") {
                  value = value.substring(0, i) + value.substring(i + 1, j) + value.substring(j + 1);
                  i = j - 1;
                  break
                } else {
                  value = value.substring(0, j) + value.substring(++j)
                }
              }
              if (j == -1) {
                value = value.substring(0, i) + value.substring(i + 1)
              }
            }
          }
        } else {
          if (value[i] == "{") {
            j = value.indexOf("}", i + 1);
            if (j == -1) {
              i++
            } else {
              index = parseInt(value.substring(i + 1, j));
              if (!isNaN(index) && index >= 0) {
                var s = value.substring(0, i);
                if (s != "") {
                  arr.push(s)
                }
                arr.push(index);
                i = 0;
                value = value.substring(j + 1)
              } else {
                i = j + 1
              }
            }
          } else {
            i++
          }
        }
      }
      if (value != "") {
        arr.push(value)
      }
      value = arr;
      $.i18n.map[key] = arr
    }
    if (value.length == 0) {
      return ""
    }
    if (value.lengh == 1 && typeof(value[0]) == "string") {
      return value[0]
    }
    var s = "";
    for (i = 0; i < value.length; i++) {
      if (typeof(value[i]) == "string") {
        s += value[i]
      } else {
        if (value[i] + 1 < arguments.length) {
          s += arguments[value[i] + 1]
        } else {
          s += "{" + value[i] + "}"
        }
      }
    }
    return s
  };
  $.i18n.browserLang = function() {
    return normaliseLanguageCode(navigator.language || navigator.userLanguage)
  };

  function loadAndParseFile(filename, settings) {
    $.ajax({
      url: filename,
      async: false,
      cache: settings.cache,
      contentType: "text/plain;charset=" + settings.encoding,
      dataType: "text",
      success: function(data, status) {
        $.i18n.loaded = true;
        parseData(data, settings.mode)
      },
      error: function() {
        $.i18n.loaded = false
      }
    })
  }

  function parseData(data, mode) {
    var parsed = "";
    var parameters = data.split(/\n/);
    var regPlaceHolder = /(\{\d+\})/g;
    var regRepPlaceHolder = /\{(\d+)\}/g;
    var unicodeRE = /(\\u.{4})/ig;
    for (var i = 0; i < parameters.length; i++) {
      parameters[i] = parameters[i].replace(/^\s\s*/, "").replace(/\s\s*$/, "");
      if (parameters[i].length > 0 && parameters[i].match("^#") != "#") {
        var pair = parameters[i].split("=");
        if (pair.length > 0) {
          var name = unescape(pair[0]).replace(/^\s\s*/, "").replace(/\s\s*$/, "");
          var value = pair.length == 1 ? "" : pair[1];
          while (value.match(/\\$/) == "\\") {
            value = value.substring(0, value.length - 1);
            value += parameters[++i].replace(/\s\s*$/, "")
          }
          for (var s = 2; s < pair.length; s++) {
            value += "=" + pair[s]
          }
          value = value.replace(/^\s\s*/, "").replace(/\s\s*$/, "");
          if (mode == "map" || mode == "both") {
            var unicodeMatches = value.match(unicodeRE);
            if (unicodeMatches) {
              for (var u = 0; u < unicodeMatches.length; u++) {
                value = value.replace(unicodeMatches[u], unescapeUnicode(unicodeMatches[u]))
              }
            }
            $.i18n.map[name] = value
          }
          if (mode == "vars" || mode == "both") {
            value = value.replace(/"/g, '\\"');
            checkKeyNamespace(name);
            if (regPlaceHolder.test(value)) {
              var parts = value.split(regPlaceHolder);
              var first = true;
              var fnArgs = "";
              var usedArgs = [];
              for (var p = 0; p < parts.length; p++) {
                if (regPlaceHolder.test(parts[p]) && (usedArgs.length == 0 || usedArgs.indexOf(parts[p]) == -1)) {
                  if (!first) {
                    fnArgs += ","
                  }
                  fnArgs += parts[p].replace(regRepPlaceHolder, "v$1");
                  usedArgs.push(parts[p]);
                  first = false
                }
              }
              parsed += name + "=function(" + fnArgs + "){";
              var fnExpr = '"' + value.replace(regRepPlaceHolder, '"+v$1+"') + '"';
              parsed += "return " + fnExpr + ";};"
            } else {
              parsed += name + '="' + value + '";'
            }
          }
        }
      }
    }
    eval(parsed)
  }

  function checkKeyNamespace(key) {
    var regDot = /\./;
    if (regDot.test(key)) {
      var fullname = "";
      var names = key.split(/\./);
      for (var i = 0; i < names.length; i++) {
        if (i > 0) {
          fullname += "."
        }
        fullname += names[i];
        if (eval("typeof " + fullname + ' == "undefined"')) {
          eval(fullname + "={};")
        }
      }
    }
  }

  function getFiles(names) {
    return (names && names.constructor == Array) ? names : [names]
  }

  function normaliseLanguageCode(lang) {
    lang = lang.toLowerCase();
    if (lang.length > 3) {
      lang = lang.substring(0, 3) + lang.substring(3).toUpperCase()
    }
    return lang
  }

  function unescapeUnicode(str) {
    var codes = [];
    var code = parseInt(str.substr(2), 16);
    if (code >= 0 && code < Math.pow(2, 16)) {
      codes.push(code)
    }
    var unescaped = "";
    for (var i = 0; i < codes.length; ++i) {
      unescaped += String.fromCharCode(codes[i])
    }
    return unescaped
  }
  var cbSplit;
  if (!cbSplit) {
    cbSplit = function(str, separator, limit) {
      if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
        if (typeof cbSplit._nativeSplit == "undefined") {
          return str.split(separator, limit)
        } else {
          return cbSplit._nativeSplit.call(str, separator, limit)
        }
      }
      var output = [],
        lastLastIndex = 0,
        flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.sticky ? "y" : ""),
        separator = RegExp(separator.source, flags + "g"),
        separator2, match, lastIndex, lastLength;
      str = str + "";
      if (!cbSplit._compliantExecNpcg) {
        separator2 = RegExp("^" + separator.source + "$(?!\\s)", flags)
      }
      if (limit === undefined || +limit < 0) {
        limit = Infinity
      } else {
        limit = Math.floor(+limit);
        if (!limit) {
          return []
        }
      }
      while (match = separator.exec(str)) {
        lastIndex = match.index + match[0].length;
        if (lastIndex > lastLastIndex) {
          output.push(str.slice(lastLastIndex, match.index));
          if (!cbSplit._compliantExecNpcg && match.length > 1) {
            match[0].replace(separator2, function() {
              for (var i = 1; i < arguments.length - 2; i++) {
                if (arguments[i] === undefined) {
                  match[i] = undefined
                }
              }
            })
          }
          if (match.length > 1 && match.index < str.length) {
            Array.prototype.push.apply(output, match.slice(1))
          }
          lastLength = match[0].length;
          lastLastIndex = lastIndex;
          if (output.length >= limit) {
            break
          }
        }
        if (separator.lastIndex === match.index) {
          separator.lastIndex++
        }
      }
      if (lastLastIndex === str.length) {
        if (lastLength || !separator.test("")) {
          output.push("")
        }
      } else {
        output.push(str.slice(lastLastIndex))
      }
      return output.length > limit ? output.slice(0, limit) : output
    };
    cbSplit._compliantExecNpcg = /()??/.exec("")[1] === undefined;
    cbSplit._nativeSplit = String.prototype.split
  }
  String.prototype.split = function(separator, limit) {
    return cbSplit(this, separator, limit)
  }
})(jQuery);