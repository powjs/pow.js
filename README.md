# PowJS

[![badge](https://img.shields.io/badge/Pow-ECMAScript-green.svg?style=flat-square)](https://github.com/powjs/powjs)
[![npm](https://img.shields.io/npm/l/powjs.svg?style=flat-square)](https://www.npmjs.org/package/powjs)
[![npm](https://img.shields.io/npm/dm/powjs.svg?style=flat-square)](https://www.npmjs.org/package/powjs)
[![npm](https://img.shields.io/npm/dt/powjs.svg?style=flat-square)](https://www.npmjs.org/package/powjs)

PowJS 是一个 ECMAScript 6 编译型 Real-DOM 模板引擎.

    Real DOM 直接在 DOM Tree 上编译, 渲染. DOM Tree 就是模板.
    原生语法 指令与 ECMAScript 原生语法对应
    导出视图 采用 ECMAScript 源码
    属性插值 name="somethin {{expr}}"
    文本插值 剔除文本节点两端空白后对 {{expr}} 进行插值
    缺省形参 顶层缺省形参为 (v, k)
    形参传递 除非使用 param 指令, 子层继承上层的形参

绕过文档直视 [Demo](https://codepen.io/achun/project/full/XjEvaw)

流程

```text
HTML string ---> Real DocumentFragment
                   |
                   V
Real Node   ---> PowJS <---> View
                   |
                   V
                 render(...args)
                   |
                   V
                 Real DocumentFragment ---> Real DOM
```

## install

NodeJS 环境

```sh
yarn add powjs
```

浏览器环境

```html
<script src="//unpkg.com/powjs"></script>
```

## 入门

PowJS 是个 module, 入口函数定义为:

```js
module.exports = function (source, option) {
  /**
   * 参数
   *
   *   source:
   *      undefined     返回 PowJS.prototype
   *      string        编译  HTML 源码
   *      Node          编译 单个 DOM 节点
   *      [Node]        编译 多个 DOM 节点
   *      [Array]       载入 已编译的 PowJS 视图
   *      其它          抛出错误或渲染结果为空
   *
   *   option:
   *      string        可选编译时指令前缀, 缺省为 ''
   *      Object        可选渲染插件, 键值是属性名, 值是函数
   *      其它          忽略
   *
   * 返回
   *
   *   PowJS.prototype  如果 source === undefined
   *   PowJS 实例       如果 source instanceof Node
   *                      或 Array.isArray(source)
   */
};
```

渲染过程在 DocumentFragment 中进行, 不直接影响页面.

导出的视图是视图数组, 每个视图的结构与 DOM 节点结构对应:

```js
/*! Generated by PowJS. Do not edit */
module.exports = [
  [
    'TAG',
    {/*Non-interpolation attribute*/},
    function (param, paramN) {
        /*directives or interpolation*/
    },
    [
        /*...view of childNodes*/
    ]
  ]
  /* more view ...*/
];
```

以面包屑导航为例:

```html
<nav>
  <div class="nav-wrapper">
    <div class="col s12">
      <a href="#!" class="breadcrumb">First</a>
      <a href="#!" class="breadcrumb">Second</a>
      <a href="#!" class="breadcrumb">Third</a>
    </div>
  </div>
</nav>
```

PowJS 模板写法:

```html
<nav>
  <div class="nav-wrapper">
    <div class="col s12" each="v">
      <!-- 下面的 v 是推导形参, 是上面 v 的遍历元素 -->
      <a href="#!" class="breadcrumb">{{v}}</a>
    </div>
  </div>
</nav>
```

使用 PowJS 编译并生成代码(视图数组):

```js
const powjs = require('powjs');
let instance = powjs(htmlOrNodeOrView);
instance.toScript();
// instance.render(['First','Second','Third']);
```

生成:

```js
[          // 支持多个节点, 所以是个视图数组
  [
    "NAV", // 标签
    0,     // 该节点没有静态属性
    0,     // 该节点没有指令和插值属性
    [      // 子节点
      [
        "DIV",
        { class: "nav-wrapper" },
        0,
        [
          [
            "DIV",
            { class: "col s12" },
            function(v, k) {       // 指令生成的视图函数
              this.each(v);
            },
            [
              [
                "A",
                { href: "#!", class: "breadcrumb" },
                0,
                [
                  [
                    "#",
                    0,
                    function(v, k) {
                      this.text(`${v}`);
                    }
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  ]
]
```

## 指令

指令在节点中是属性, 值为 ECMAScript 表达式或语句, 最终拼接生成视图函数.

    param  ="v,k"             生成视图函数的形参: 参见示例
    if     ="cond"            渲染条件和可变标签: 参见下文
    let    ="a=expr,b=1"      局部变量: let a=expr,b=1;
    do     ="code"            执行代码: code;
    text   ="expr"            设置文本: this.text(expr);
    html   ="expr"            设置HTML: this.html(expr);
    end                       保留本节点, 终止渲染: return this.end();
    end    ="cond"            保留本节点, 终止条件: if(cond) return this.end();
    skip                      不渲染子层: this.skip();
    skip   ="cond"            子层渲染条件: if(cond) this.skip();
    break                     不渲染兄弟层: this.break();
    break  ="cond"            兄弟层渲染条件: if(cond) this.break();
    render ="args,argsN"      渲染子层: this.render(args,argsN);
    each   ="expr,args,argsN" 遍历渲染子层: this.each(expr,args,argsN);

指令 `param` 和 `if` 应该位于其它指令指令之前, 其它指令或插值属性按照出现的次序
生成视图函数主体代码.

如果没有使用 `render` 或 `each`, PowJS 会生成缺省的并带上继承的形参.

### 节点构建次序

节点构建次序:

1. 创建节点 包含 `if` 指令产生的代码
1. 设置静态属性 无插值的属性
1. 执行生成视图函数, 具体代码和指令或插值属性出现的次序一致

### if

指令 `if` 会生成一个函数, 判定渲染条件的同时可以改变节点名称.

例: 纯渲染条件

```html
<ul param="data" if="Array.isArray(data)"></ul>
```

生成:

```js
[
  [
    function(data) {
      return Array.isArray(data) && "UL";
    },
  ]
]
```

例: 动态改变标签名, 以 `||` 结尾

```html
<ul param="data" if="Array.isArray(data) && 'OL' ||"></ul>
```

生成:

```js
[
  [
    function(data) {
      return (Array.isArray(data) && "OL") || "UL";
    },
  ]
]
```

例: 使用引号包裹的占位符 `---`, 但 PowJS 不会判断引号是否存在.

```html
<ul param="data" if="Array.isArray(data) && '---'"></ul>
```

生成:

```js
[
  [
    function(data) {
      return Array.isArray(data) && "UL";
    },
  ]
]
```

该指令的内部实现:

```js
directives.if = function(exp, tag) {
  if(exp.includes('---')){
    exp = exp.replace(/---/g, tag);
    return `return ${exp};`;
  }

  if(exp.endsWith('||'))
    return `return ${exp} '${tag}';`;
  return `return ${exp} && '${tag}';`;
};
```

即:

1. 包含占位符 `---`, 替换 `---` 为当前标签名
1. 以 `||` 结尾, 添加 `TAG`
1. 否则添加 `&& TAG`

返回值的影响:

- 非字符串   放弃创建节点
- 空字符串   放弃创建节点
- `#` 开头   创建 `Text` 节点, 使用者需要控制后续的代码是否产生冲突
- 其它字符串 创建 `Element` 节点

### do

当其它指令无法满足需求时 `do` 是最后一招, 直接写原生 ECMAScript 代码.

例:

```html
<div param="array" if="isArray(array)"
  do="if(isArray(array[0])) return this.each(array)">
  ...
</div>
```

生成:

```js
[
  [
    function(array) {
      return isArray(array) && "DIV";
    },
    0,
    function(array) {
      if (isArray(array[0])) return this.each(array);
      this.render(array); // PowJS 补全缺省行为
    },
    [["#..."]]            // # 开头的是 Text 节点
  ]
]
```

如果使用了指令或插值, 但指令都和渲染无关, PowJS 就会补全 `this.render`.

同理, 善用 `skip` 指令可以避免补全的 `this.render` 被执行.

## 属性和方法

属性:

    $       插件, 如果需要可以随时设置
    node    只读, 当前渲染生成的节点
    parent  只读, 当前节点的父节点, 最顶层是 DocumentFragment BODY 临时节点

方法:

    create()          内部方法, 构建当前节点
    end()             内部方法, 用于指令
    break()           内部方法, 用于指令
    render(...)       渲染入口, 渲染并返回 this
    each(x,...)       遍历渲染, 渲染并返回 this, 内部调用 this.render(..., v, k)
    text(expr)        指令专用
    html(expr)        指令专用
    isRoot()          辅助方法, 返回 this 是否是最顶层的 PowJS 实例
    attr(attrName[,v])辅助方法, 设置或返回前节点属性值
    prop(propName[,v])辅助方法, 设置或返回前节点特征值. 比如 checked.
    firstChild()      辅助方法, 返回 this.parent.firstChild
    childNodes()      辅助方法, 返回 this.parent.childNodes
    lastChild()       辅助方法, 返回 this.parent.lastChild
    query(selector)   辅助方法, 返回 this.parent.querySelectorAll(selector)
    slice(...)        辅助方法, 调用 Array.prototype.slice
    inc()             辅助方法, 计数器 return ++counter
    pow(inc)          辅助方法, 计数ID if(inc)this.inc();return '-pow-'+counter
    toScript()        辅助方法, 导出视图源码
    exports(target)   辅助方法, 导出视图源码, 前缀 `module.exports =`
    renew(node)       节点操作, 用渲染的节点替换 node
    appendTo(node)    节点操作, 追加渲染的节点到 node 末尾
    insertBefore(node)节点操作, 插入渲染的节点到 node 之前
    insertAfter(node) 节点操作, 插入渲染的节点到 node 之后

### each

同名指令 `each`, 该方法可遍历 `[object Object]` 或 ArrayLike 对象.
总是附加参数: 值, 键(序号) 传递给 `render` 方法.

### end

只要调用了 `end()` 方法, 必须确保结束视图函数, 就像指令方式用 `return` 那样.
否则, 复杂的逻辑或不良的指令次序可能会造成非预期的结果.

## isRoot

模块生成的 PowJS 实例是顶层实例, 渲染过程中的会生成临时实例.
顶层实例的 `parent` 属性和 `node` 属性是同一个对象.

实现:

```js
PowJS.prototype.isRoot = function() {
  return !this.node.parentElement;
};
```

这个对象是:

```js
document.createDocumentFragment()
  .appendChild(
    document.createElement('BODY')
  );
```

所以渲染过程在 DocumentFragment 中进行, 不直接影响页面.

顶层实例可能会拥有多个子节点, 这取决于:

- 模板顶层有多个节点
- render 被多次执行
- 子节点是否被添加到页面上(取走)

造成事实:

- view   视图数组, 每个元素都是生成一个节点的一个视图
- render 渲染子节点, 遍历渲染 view 数组的每个元素, 生成子节点添加到 parent
- each   遍历渲染子节点, 调用 render 并传递值, 键(索引)

不应该对顶层对象使用 `attr`, `prop` 方法. 慎用 `text`, `html` 方法.

## plugins

插件是一个函数, 在渲染时执行. 定义:

```js
/**
 * 插件原型, 如果被执行, PowJS 不再对该属性进行设置
 * @param  {PowJS}   pow  当前的 PowJS 实例
 * @param  {string}  val  属性值
 * @param  {string}  key  属性名
 */
function plugin(pow, val, key) {
    //...
}
```

例:

```js
let pow = require('powjs');

pow(`<img src="1.jpg" do="this.attr('src','2.jpg')">`, {
    plugins:{
        'src': function(pow, val) {
            pow.attr('data-src', val);
        }
    }
}).render().node.innerHTML;
// output: <img data-src="2.jpg">
```

## 赞助

赞助以帮助 PowJS 持续更新

![通过支付宝赞助](https://user-images.githubusercontent.com/489285/31326203-9b0c95c0-ac8a-11e7-9161-b2d8f1cc00e8.png)
![通过微信赞助](https://user-images.githubusercontent.com/489285/31326223-c62b133a-ac8a-11e7-9af5-ff5465872280.png)
[![通过 Paypal 赞助](https://user-images.githubusercontent.com/489285/31326166-63e63682-ac8a-11e7-829a-0f75875ac88a.png)](https://www.paypal.me/HengChunYU/5)

## License

MIT License <https://github.com/powjs/powjs/blob/master/LICENSE>

[PowJS]: https://github.com/powjs/powjs
