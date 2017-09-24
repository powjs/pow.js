'use strict';

// PowJS Template engine https://github.com/powjs/powjs
// MIT License https://github.com/powjs/powjs/blob/master/LICENSE

const TEXT_NODE = 3,
	COMMENT_NODE = 8,
	// 因 toScript 有硬依赖, 该次序不能变
	TAG = 0,
	ATTRS = 1,
	CHILDS = 2,
	FN = 3,
	toString = Object.prototype.toString,
	slice = Array.prototype.slice,
	TMPL = /{{|}}/m,
	directives = Object.create(null);

directives.param = function(args) {
	return args;
}

directives.if = function(exp) {
	return 'if(!(' + (exp || '0') + ')) return;';
}

directives.let = function(exp) {
	return exp && 'var ' + exp + ';' || ';';
}
directives.do = function(exp) {
	return exp + ';';
}
directives.text = function(exp) {
	return 'return this.text(' + exp + ');'
}
directives.html = function(exp) {
	return 'return this.html(' + exp + ');'
}

directives.skip = function(exp) {
	return !exp && 'return;' ||
		'if(' + exp + ') return;';
}
directives.break = function(exp) {
	return !exp && 'this.break();' ||
		'if(' + exp + ') this.break();';
}
directives.end = function(exp) {
	return !exp && 'this.end();' ||
		'if(' + exp + ') this.end();';
}
directives.render = function(args) {
	return 'return this.render(' + args + ')';
}
directives.each = function(args) {
	return 'return this.each(' + args + ')';
}

module.exports = function Pow(source, mixed /*,...renderArgs*/ ) {
	let view = [],
		prefix = '',
		discard = [];

	if (source === undefined) return PowJS.prototype;

	if (typeof source === 'string')
		source = firstChild(source);

	if (toString.call(mixed) === '[object Object]') {
		prefix = mixed.prefix || '';
		discard = typeof mixed.discard === 'string' && [mixed.discard] ||
			Array.isArray(mixed.discard) && mixed.discard || discard;
	} else {
		mixed = mixed || Object.create(null);
	}

	if (source instanceof Node)
		compile(view, source, prefix, discard, 'v,k');
	else if (Array.isArray(source))
		view = source;

	let pow = new PowJS(
		document.createDocumentFragment().appendChild(
			document.createElement('BODY')), view,
		toString.call(mixed) === '[object Object]' &&
		mixed || Object.create(null));

	if (arguments.length > 2 || mixed instanceof Node) {
		pow.render.apply(pow, slice.call(arguments, 2));
		if (mixed instanceof Node &&
			typeof mixed.replaceWith === 'function')
			mixed.replaceWith(pow.firstChild());
	}
	return pow;
}

function firstChild(source) {
	let b = document.createDocumentFragment()
		.appendChild(document.createElement('BODY'));

	b.innerHTML = source.trim();
	return b.firstChild;
}

function PowJS(parent, view, context) {
	context.node = null;
	context.flag = 0;
	this.parent = parent;
	this.view = view;
	this.$ = context;
}

function toScript(sum, view) {
	// 固定次序 [TAG,ATTRS,CHILDS,FN]
	return sum + (!!sum && ',' || '') + '["' + view[TAG] + '",' +

		JSON.stringify(view[ATTRS]) +

		(view[CHILDS] && view[CHILDS].length &&
		',[' + view[CHILDS].reduce(toScript, '') + '],' || ',null,') +

		(view[FN] && view[FN].toString()
			.replace(/^function anonymous\(/, 'function (')
			.replace("\n/*``*/", '') || 'null') + ']';
}

PowJS.prototype.export = function() {
	return (this.view && this.view.length) &&
		toScript('', this.view) || 'null';
}

PowJS.prototype.childNodes = function() {
	return this.parent.childNodes;
}

PowJS.prototype.firstChild = function() {
	return this.parent.firstChild;
}

PowJS.prototype.node = function() {
	return this.$.node
}

PowJS.prototype.create = function() {
	let tag = this.view[TAG],
		attrs = this.view[ATTRS];

	this.$.node = this.parent.appendChild(
		tag == '#text' &&
		document.createTextNode('') ||
		document.createElement(tag)
	);

	for (let key in attrs)
		this.$.node.setAttribute(key, attrs[key]);
}

PowJS.prototype.render = function() {
	let args = slice.call(arguments, 0);

	if (!this.$.node)
		return this.view[FN].apply(this, args);
	each(this.$, this.view[CHILDS], args);
}

function each($, views, args) {
	let node = $.node,
		flag = $.flag;
	$.flag = 0;
	views && views.every(function(view) {
		let pow = new PowJS(node, view, $);
		pow.render.apply(pow, args);
		return $.flag == 0;
	});
	if ($.flag != -1)
		$.flag = flag;
	$.node = node;
}

PowJS.prototype.each = function(iterator) {
	let k = 0,
		views = this.view[CHILDS],
		args = slice.call(arguments, 1),
		i = args.length;

	// 根调用
	if (!this.$.node) {
		this.view[CHILDS] = null;
		this.view[FN].apply(this, args);
		this.view[CHILDS] = views;
	}

	args = args.concat([null, null]);

	if (toString.call(iterator) == '[object Object]') {
		for (k in iterator) {
			args[i] = iterator[k];
			args[i + 1] = k;
			each(this.$, views, args);
		}
	} else {
		for (let v of iterator) {
			args[i] = v;
			args[i + 1] = k++;
			each(this.$, views, args);
		}
	}
}

PowJS.prototype.text = function(text) {
	if (text == null)
		return this.$.node.textContent;
	this.$.node.textContent = text + '';
}

PowJS.prototype.html = function(html) {
	let node = this.node();
	if (html == null)
		return node.innerHTML || node.textContent;

	if (node.nodeType == TEXT_NODE)
		this.$.node.textContent = html + '';
	else
		this.$.node.innerHTML = html + '';
}

PowJS.prototype.end = function() {
	this.$.flag = -1
}

PowJS.prototype.break = function() {
	this.$.flag = 1
}

PowJS.prototype.attr = function(key, val) {
	if (typeof key !== 'string') return;
	if (val === undefined)
		return this.$.node.hasAttribute(key)
			? this.$.node.getAttribute(key)
			: this.$.node[key];
	this.$.node.setAttribute(key, val);
}

PowJS.prototype.required = function() {
	this.$.node.setAttribute('required', 'required');
}

PowJS.prototype.slice = function(array, start, end) {
	return slice.call(array, start, end)
}

let counter = 0;

PowJS.prototype.inc = function() {
	return ++counter;
}

PowJS.prototype.pow = function() {
	return 'pow-' + counter;
}

const ENDING = 'text html render each'.split(' '),
	PARAMS_TEST = /^[$_a-zA-Z][$_a-zA-Z\d]*(\s*,\s*[$_a-zA-Z][$_a-zA-Z\d]*)*$/;

function compile(view, node, prefix, discard, param) {
	let body = '',
		args = null,
		render = '';

	if (node.nodeType === TEXT_NODE) {
		body = parseTemplate(node.textContent.trim());
		if (body) {
			view[TAG] = '#text';
			view[ATTRS] = view[CHILDS] = null;
			view[FN] = Function(
				param,
				'this.create();' + body);
		}
		return;
	}

	view[TAG] = node.nodeName;
	view[ATTRS] = view[CHILDS] = null;
	if (node.hasAttribute(prefix + 'param')) {
		param = directives.param((node.getAttribute(prefix + 'param') || '').trim());
	}

	if (node.hasAttribute(prefix + 'if')) {
		body = directives.if((node.getAttribute(prefix + 'if') || '').trim() || '0');
	}

	body += 'this.create();';

	for (let i = 0; i < node.attributes.length; i++) {
		let attr = node.attributes[i],
			di = directives[
				prefix && attr.name.startsWith(prefix) ?
					attr.name.slice(prefix.length) : attr.name],
			name = !di && attr.name || attr.name.slice(prefix.length),
			val = attr.value.trim();

		if (!di) {
			if (discard.indexOf(name) != -1) {
				continue;
			}
			if (val && val[0] == '<' && val[val.length - 1] == '>') {
				body += 'this.attr("' + name + '",' + val.slice(1, -1) + ');';
			} else {
				view[ATTRS] = view[ATTRS] || Object.create(null);
				view[ATTRS][name] = val;
			}
			continue;
		}
		if (render || name == 'if' || name == 'param') continue;

		body += di(val);
		if (ENDING.indexOf(name) + 1) {
			render = name;
			if (render == 'html' || render == 'text') continue;
			args = PARAMS_TEST.test(val) && val.split(/\s*,\s*/) || null;
			if (args && name == 'each') {
				args.push('v');
				args.push('k');
				args = args.slice(1);
			}
			args = args && isUnique(args) && args.join(',') || null;
		}
	}

	if (!render) {
		body += directives.render(param);
	}

	view[FN] = new Function(param, body);

	if (render == 'html' || render == 'text') return;

	param = args || param;

	for (let i = 0; i < node.childNodes.length; i++) {
		if (node.childNodes[i].nodeType == COMMENT_NODE)
			continue;

		let v = [];
		compile(v, node.childNodes[i], prefix, discard, param);
		if (v.length) {
			view[CHILDS] = view[CHILDS] || [];
			view[CHILDS].push(v);
		}
	}
}

function isUnique(array) {
	if (!array.length) return true;
	array = array.slice(0).sort();
	return ',' != array.slice(1).reduce(function(s, v) {
			return (s === ',' || s === v) && ',' || v
		}, array[0]);
}

function parseTemplate(txt) {
	if (!txt) return '';

	if (txt.indexOf('{{') == -1)
		return directives.text(JSON.stringify(txt));
	let a = txt.split(TMPL);
	if (a.length & 1 == 0)
		throw new Error('The symbols "{{}}" unpaired: ' + txt);
	txt = '';
	for (let i = 0; i < a.length; i++) {
		if (!a[i]) continue;
		txt += '+' + (i & 1 ? '(' + a[i] + ')' : JSON.stringify(a[i]));
	}

	return directives.text(txt.slice(1));
}
