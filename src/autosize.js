const map = (typeof Map === "function") ? new Map() : (function () {
	const keys = [];
	const values = [];

	return {
		has(key) {
			return keys.indexOf(key) > -1;
		},
		get(key) {
			return values[keys.indexOf(key)];
		},
		set(key, value) {
			if (keys.indexOf(key) === -1) {
				keys.push(key);
				values.push(value);
			}
		},
		delete(key) {
			const index = keys.indexOf(key);
			if (index > -1) {
				keys.splice(index, 1);
				values.splice(index, 1);
			}
		},
	}
})();

//创建自定义事件
let createEvent = (name)=> new Event(name, {bubbles: true});
try {
	new Event('test');
} catch(e) {
	// IE does not support `new Event()`
	createEvent = (name)=> {
		const evt = document.createEvent('Event');
		evt.initEvent(name, true, false);
		return evt;
	};
}

/**
 * 
 * @param TEXTAREA ta 
 */
function assign(ta) { 
	if (!ta || !ta.nodeName || ta.nodeName !== 'TEXTAREA' || map.has(ta)) return;

	let heightOffset = null; // ta 的应用高度
	let clientWidth = null; // ta 的可视宽度
	let cachedHeight = null; // 上次高度

	function init() {
		const style = window.getComputedStyle(ta, null);//获取当前活跃的css属性

		if (style.resize === 'vertical') { // 垂直方向可控
			ta.style.resize = 'none';
		} else if (style.resize === 'both') { // 垂直水平方向可控
			ta.style.resize = 'horizontal';
		}

		if (style.boxSizing === 'content-box') {
			heightOffset = -(parseFloat(style.paddingTop)+parseFloat(style.paddingBottom));
		} else {
			heightOffset = parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
		}
		// Fix when a textarea is not on document body and heightOffset is Not a Number
		if (isNaN(heightOffset)) {
			heightOffset = 0;
		}

		update(); //修改高度开始
	}

	function changeOverflow(value) {
		{//作用域
			// 兼容 textarea 不解内容已经修改，通过强制修改样式，使textarea重绘，生效
			// Chrome/Safari-specific fix:
			// When the textarea y-overflow is hidden, Chrome/Safari do not reflow the text to account for the space
			// 当文本区域Y溢出被隐藏时，chrome/safari不会重新显示文本以说明空间。
			// made available by removing the scrollbar. The following forces the necessary text reflow.
			// 通过删除滚动条可用。下面强制必要的文本回流。
			const width = ta.style.width;
			ta.style.width = '0px';
			// Force reflow:
			/* jshint ignore:start */
			ta.offsetWidth;
			/* jshint ignore:end */
			ta.style.width = width;
		}

		ta.style.overflowY = value;
	}


	/**
	 * 收集 带scrollTop的parentNodes
	 * @param {*} el 
	 */
	function getParentOverflows(el) {
		const arr = [];

		while (el && el.parentNode && el.parentNode instanceof Element) {
			if (el.parentNode.scrollTop) {
				arr.push({
					node: el.parentNode,
					scrollTop: el.parentNode.scrollTop,
				})
			}
			el = el.parentNode;
		}

		return arr;
	}

	function resize() {
		if (ta.scrollHeight === 0) {
			// If the scrollHeight is 0, then the element probably has display:none or is detached from the DOM.
			return;
		}

		const overflows = getParentOverflows(ta);
		const docTop = document.documentElement && document.documentElement.scrollTop; // Needed for Mobile IE (ticket #240)

		ta.style.height = '';
		ta.style.height = (ta.scrollHeight+heightOffset)+'px';//设置当前 scrollHeight 高度

		// used to check if an update is actually necessary on window.resize
		clientWidth = ta.clientWidth;

		// 防止滚动坐标跳跃 这个小优化让滚动条不动
		overflows.forEach(el => {
			el.node.scrollTop = el.scrollTop
		});

		if (docTop) {
			document.documentElement.scrollTop = docTop;
		}
	}

	function update() {
		resize();

		const styleHeight = Math.round(parseFloat(ta.style.height));//获取当前style 高度
		const computed = window.getComputedStyle(ta, null);//获取当前活跃 style

		// Using offsetHeight as a replacement for computed.height in IE, because IE does not account use of border-box
		// 用offsetHeight代替computed。高度在IE中，因为IE不计入边框使用
		var actualHeight = computed.boxSizing === 'content-box' ? Math.round(parseFloat(computed.height)) : ta.offsetHeight;

		// The actual height not matching the style height (set via the resize method) indicates that  
		// 实际高度不匹配样式高度(通过resize方法设置)表明
		// the max-height has been exceeded, in which case the overflow should be allowed. 
		// 已经超过max-height，在这种情况下应该允许溢出。
		if (actualHeight < styleHeight) {
			if (computed.overflowY === 'hidden') {
				changeOverflow('scroll');
				resize();
				actualHeight = computed.boxSizing === 'content-box' ? Math.round(parseFloat(window.getComputedStyle(ta, null).height)) : ta.offsetHeight;
			}
		} else {
			// Normally keep overflow set to hidden, to avoid flash of scrollbar as the textarea expands. 
			// 通常将溢出设置为隐藏，以避免滚动条在文本区域扩展时闪烁。
			if (computed.overflowY !== 'hidden') {
				changeOverflow('hidden');
				resize();
				actualHeight = computed.boxSizing === 'content-box' ? Math.round(parseFloat(window.getComputedStyle(ta, null).height)) : ta.offsetHeight;
			}
		}

		if (cachedHeight !== actualHeight) {
			cachedHeight = actualHeight;
			const evt = createEvent('autosize:resized');
			try {
				ta.dispatchEvent(evt);
			} catch (err) {
				// Firefox will throw an error on dispatchEvent for a detached element
				// https://bugzilla.mozilla.org/show_bug.cgi?id=889376
			}
		}
	}

	const pageResize = () => {
		if (ta.clientWidth !== clientWidth) {
			update();
		}
	};


	// 清除方法
	const destroy = (style => {
		window.removeEventListener('resize', pageResize, false);
		ta.removeEventListener('input', update, false);
		ta.removeEventListener('keyup', update, false);
		ta.removeEventListener('autosize:destroy', destroy, false);
		ta.removeEventListener('autosize:update', update, false);

		Object.keys(style).forEach(key => {
			ta.style[key] = style[key];
		});

		map.delete(ta);
	}).bind(ta, {
		height: ta.style.height,
		resize: ta.style.resize,
		overflowY: ta.style.overflowY,
		overflowX: ta.style.overflowX,
		wordWrap: ta.style.wordWrap,
	});

	ta.addEventListener('autosize:destroy', destroy, false);//订阅，用户确认执行 destroy() 等同 .destroy()

	// IE9 does not fire onpropertychange or oninput for deletions,
	// so binding to onkeyup to catch most of those events.
	// There is no way that I know of to detect something like 'cut' in IE9.
	if ('onpropertychange' in ta && 'oninput' in ta) {
		ta.addEventListener('keyup', update, false);
	}

	window.addEventListener('resize', pageResize, false);
	ta.addEventListener('input', update, false);
	ta.addEventListener('autosize:update', update, false); //订阅，用户确认执行 update() 等同 .update()

	ta.style.overflowX = 'hidden';
	ta.style.wordWrap = 'break-word';

	map.set(ta, {
		destroy,
		update,
	});

	init(); //主函数，初始化
}

function destroy(ta) {
	const methods = map.get(ta);
	if (methods) {
		methods.destroy();
	}
}

function update(ta) {
	const methods = map.get(ta);
	if (methods) {
		methods.update();
	}
}

let autosize = null;

// Do nothing in Node.js environment and IE8 (or lower)
if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
	autosize = el => el;
	autosize.destroy = el => el;
	autosize.update = el => el;
} else {
	autosize = (el, options) => {//主入口
		if (el) {
			Array.prototype.forEach.call(el.length ? el : [el], x => assign(x, options));
		}
		return el;
	};
	autosize.destroy = el => {//方法1
		if (el) {
			Array.prototype.forEach.call(el.length ? el : [el], destroy);
		}
		return el;
	};
	autosize.update = el => {//方法2
		if (el) {
			Array.prototype.forEach.call(el.length ? el : [el], update);
		}
		return el;
	};
}

export default autosize;
