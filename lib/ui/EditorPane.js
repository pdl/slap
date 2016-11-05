var blessed = require('blessed');
var path = require('path');
var _ = require('lodash');

var util = require('slap-util');

var Editor = require('editor-widget');

var Pane = require('./Pane');

EditorPane.prototype.__proto__ = Pane.prototype;
function EditorPane (opts) {
  var self = this;

  if (!(self instanceof EditorPane)) return new EditorPane(opts);

  Pane.call(self, _.merge({}, Slap.global.options.editorPane, opts));

  self.forms = self.forms || [];

  self.editor = new Editor(_.merge({
    parent: self,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  }, Slap.global.options.editor, self.options.editor));

  self.findForm = new FindForm({parent: self});
  self.goLineForm = new GoLineForm({parent: self});
  self.saveAsForm = new SaveAsForm({parent: self});
  self.saveAsCloseForm = new SaveAsCloseForm({parent: self});
}
EditorPane.prototype.setCurrent = function () {
  var self = this;
  Pane.prototype.setCurrent.apply(self, arguments);
  self.editor.focus();
  return self;
};

EditorPane.prototype.getTitle = function () {
  var self = this;
  var textBuf = self.editor.textBuf;
  var editorPath = textBuf.getPath();
  var title = editorPath
    ? blessed.escape(path.relative(self.screen.slap.fileBrowser.cwd, editorPath))
    : "new file";
  if (textBuf.isModified()) {
    title = util.markup(title+"*", self.style.changed);
  }
  return title.toString();
};

EditorPane.prototype.close = function () {
  var self = this;
  if (self.editor.textBuf.isModified()) {
    var currentPaneSaveAsCloseForm = (self.screen.slap.getCurrentPane() || {}).saveAsCloseForm || {};
    if (currentPaneSaveAsCloseForm.visible) {
      currentPaneSaveAsCloseForm.once('hide', self.close.bind(self));
    } else {
      self.setCurrent();
      self.saveAsCloseForm.show();
    }
    return false;
  }

  return Pane.prototype.close.apply(self, arguments);
};

EditorPane.prototype.save = function (path) {
  var self = this;
  var slap = self.screen.slap;
  var header = slap.header;
  var editor = self.editor;
  return editor.save(path, slap.fileBrowser.cwd)
    .tap(function () { header.message("saved to " + editor.textBuf.getPath(), 'success'); })
    .catch(function (err) {
      switch ((err.cause || err).code) {
        case 'EACCES': case 'EISDIR':
          header.message(err.message, 'error');
          break;
        default: throw err;
      }
    });
};

EditorPane.prototype._initHandlers = function () {
  var self = this;
  var editor = self.editor;
  var slap = self.screen.slap;

  self.declareBindables({
    'save': {
      action: function () {
        if (!editor.readOnly()) editor.textBuf.getPath() ? self.save().done() : self.saveAsForm.show(); return false;
      }
    },
    'saveAs': {
      action: function () {
        if (!editor.readOnly()) self.saveAsForm.show(); return false;
      }
    },
    'close': {
      action: function () {
        self.close(); return false;
      }
    },
    'find': {
      action: function () {
        self.findForm.show(); return false;
      }
    },
    'goLine': {
      action: function () {
        self.goLineForm.show(); return false;
      }
    },
  });

  self.on('element keypress', function (el, ch, key) {
    var bindableName = self.resolveBinding(key);
    if (bindableName && self.hasBindable(bindableName)) {
      return self.executeBindable(bindableName, []);
    }
  });

  self.on('focus', function () {
    var formHasFocus = false;
    var visibleForms = self.forms.filter(function (form) {
      formHasFocus = formHasFocus || form.hasFocus(true);
      return form.visible;
    });
    if (!formHasFocus && visibleForms.length) visibleForms[0].focus();
  });

  editor.on('insertMode', function () { self.screen.render(); });
  ['onDidChange', 'onDidChangePath'].forEach(function (prop) {
    editor.textBuf[prop](function () {
      slap.header.render();
      slap.paneList.update();
    });
  });

  return Pane.prototype._initHandlers.apply(self, arguments);
};

module.exports = EditorPane;

var Slap = require('./Slap');
var SaveAsForm = require('./SaveAsForm');
var SaveAsCloseForm = require('./SaveAsCloseForm');
var FindForm = require('./FindForm');
var GoLineForm = require('./GoLineForm');
