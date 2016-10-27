var _ = require('lodash');

var util = require('slap-util');
var BaseWidget = require('base-widget');

var Slap = require('./Slap');
var Pane = require('./Pane');

ActionList.prototype.__proto__ = Pane.prototype;
function ActionList (opts) {
  var self = this;

  if (!(self instanceof ActionList)) return new ActionList(opts);

  Pane.call(self, _.merge({}, Slap.global.options.actionList, opts));

  self.topContent = new BaseWidget(_.merge({
    parent: self,
    tags: true,
    shrink: true,
    top: 1,
    left: 'center',
    style: self.options.style
  }, self.options.topContent));

  var listOpts = _.merge({
    parent: self,
    mouse: true,
    keys: true,
    focusable: true,
    tags: true,
    top: 3,
    style: self.options.style
  }, self.options.list);
  self.list = new BaseWidget.blessed.List(listOpts);
  BaseWidget.call(self.list, listOpts);
}

ActionList.prototype.close = function () {
  // Don't actually close anything, just act closed and maybe setFront another pane
  var self = this;
  var slap = self.screen.slap;
  if (self === slap.getCurrentPane()) {
    var prevPane = slap.getPrevPane();
    if (prevPane) prevPane.setCurrent();
  }
  return true;
};

ActionList.prototype.getTitle = function () {
  return util.markup("<ActionList>", this.style.actionList).toString();
};

ActionList.prototype._initHandlers = function () {
  var self = this;
  var slap = self.screen.slap;

  self.on('element mousedown', function (el) { self.focus(); });

  slap.on('element keypress', function (el, ch, key) {
    if (!(el === self || el.hasAncestor(self))) return;
    switch (self.resolveBinding(key)) {
      case 'cancel':
        var prevPane = slap.getPrevPane();
        if (prevPane) prevPane.setCurrent();
        return false;
    }
  });

  self.on('focus', function () { self.screen.program.hideCursor(); });

  self.update();
  ['adopt', 'remove'].forEach(function (evt) {
    slap.on('element '+evt, function (parent, child) {
      if (child instanceof Pane) setImmediate(function () { self.update(); });
    });
  });

  self.list.on('select', function (d, i) {
    var actionData = self.list.getItem(i).actionData;
    var prevPane = (self === slap.getCurrentPane()) ? slap.getPrevPane() : slap.getCurrentPane();

    if (prevPane) {
      prevPane.setCurrent();
    }
    actionData.boundElement.executeBindable(actionData.bindableName, []);
    self.update();
  });

  return Pane.prototype._initHandlers.apply(self, arguments);
};

ActionList.prototype.makeItemContent = function (pane, key) {
  return '{light-blue-fg}'+ pane.constructor.name + ': {light-white-fg}' + key;
};

ActionList.prototype.update = function () {
  var self = this;
  var slap = self.screen.slap;
  var list = self.list;
  var pane = (self === slap.getCurrentPane()) ? slap.getPrevPane() : slap.getCurrentPane();

  list.clearItems();

  while (pane.parent) {
    _.forOwn(pane.bindables, function (value, key) {
      var item = list.appendItem(self.makeItemContent(pane,key));
      item.actionData = item.actionData || {};
      item.actionData.boundElement = pane;
      item.actionData.bindableName = key;
    });
    pane = pane.parent;
  }
  var topContent = self.topContent;
  topContent.setContent(
    list.items.length+" action"+(list.items.length === 1 ? '' : 's')
  );

  return self;
};

module.exports = ActionList;
